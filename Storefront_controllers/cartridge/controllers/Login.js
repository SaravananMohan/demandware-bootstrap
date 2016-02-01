'use strict';

/**
 * Controller for all customer login storefront processes.
 *
 * @module controllers/Login
 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var Pipelet = require('dw/system/Pipelet');

/* Script Modules */
var app            = require('~/cartridge/scripts/app');
var guard          = require('~/cartridge/scripts/guard');

var Customer       = app.getModel('Customer');

var LOGGER         = dw.system.Logger.getLogger('login');

/**
 * Contains the login page preparation and display, it is called from various
 * places implicitly when 'loggedIn' is ensured via the {@link module:guard}.
 */
function show() {
    var loginForm = app.getForm('login');
    loginForm.clear();

    var oauthLoginForm = app.getForm('oauthlogin');
    oauthLoginForm.clear();

    var orderTrackForm = app.getForm('ordertrack');
    orderTrackForm.clear();

    if (customer.registered) {
        loginForm.setValue('username', customer.profile.credentials.login);
        loginForm.setValue('rememberme', true);
    }

    var pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(dw.content.ContentMgr.getContent('myaccount-login'));

    // Save return URL in session.
    if (request.httpParameterMap.original.submitted) {
        session.custom.TargetLocation = request.httpParameterMap.original.value;
    }

    var v = app.getView('Login',{
        RegistrationStatus: false
    });
    if (request.httpParameterMap.scope.submitted) {
        switch (request.httpParameterMap.scope.stringValue) {
            case 'wishlist':
                // @TODO Update metadata for wishlist login.
                v.template = 'account/wishlist/wishlistlanding';
                break;
            case 'giftregistry':
                // @TODO Update metadata for giftregistry login.
                v.template = 'account/giftregistry/giftregistrylanding';
                break;
            default:
        }
    }
    v.render();
}

/**
 * Internal function that reads the URL that should be redirected to after successful login
 * @return {dw.web.Url} The URL to redirect to in case of success
 * or {@link module:controllers/Account~Show|Account controller Show function} in case of failure.
 */
function getTargetUrl () {
    if (session.custom.TargetLocation) {
        var target = session.custom.TargetLocation;
        delete session.custom.TargetLocation;
        //@TODO make sure only path, no hosts are allowed as redirect target
        dw.system.Logger.info('Redirecting to "{0}" after successful login',target);
        return decodeURI(target);
    } else {
        return URLUtils.https('Account-Show');
    }
}

/**
 * Form handler for the login form. Handles the following actions:
 * - __login__ - logs the customer in and renders the login page.
 * If login fails, clears the login form and redirects to the original controller that triggered the login process.
 * - __register__ - redirects to the {@link module:controllers/Account~startRegister|Account controller StartRegister function}
 * - __findorder__ - if the ordertrack form does not contain order number, email, or postal code information, redirects to
 * {@link module:controllers/Login~Show|Login controller Show function}. If the order information exists, searches for the order
 * using that information. If the order cannot be found, renders the LoginView. Otherwise, renders the order details page
 * (account/orderhistory/orderdetails template).
 * - __search__ - calls the {@link module:controllers/GiftRegistry~searchGiftRegistry|GiftRegistry controller SearchGiftRegistry function}
 * - __error__ - renders the LoginView.
 */
function handleLoginForm () {
    var loginForm = app.getForm('login');
    loginForm.handleAction({
        login: function () {
            var success = Customer.login(loginForm.getValue('username'), loginForm.getValue('password'), loginForm.getValue('rememberme'));

            if (!success) {
                loginForm.get('loginsucceeded').invalidate();
                app.getView('Login').render();
                return;
            } else {
                loginForm.clear();
            }

            // In case of successful login
            // Redirects to the original controller that triggered the login process.
            response.redirect(getTargetUrl());

            return;
        },
        register: function () {
            response.redirect(URLUtils.https('Account-StartRegister'));
            return;
        },
        findorder: function () {
            var orderTrackForm = app.getForm('ordertrack');
            var orderNumber = orderTrackForm.getValue('orderNumber');
            var orderFormEmail = orderTrackForm.getValue('orderEmail');
            var orderPostalCode = orderTrackForm.getValue('postalCode');

            if (empty(orderNumber) || empty(orderPostalCode) || empty(orderFormEmail)) {
                response.redirect(URLUtils.https('Login-Show'));
                return;
            }

            var orders = OrderMgr.searchOrders('orderNo={0} AND status!={1}', 'creationDate desc', orderNumber,
                dw.order.Order.ORDER_STATUS_REPLACED);

            if (empty(orders)) {
                app.getView('Login', {
                    OrderNotFound: true
                }).render();
                return;
            }

            var foundOrder = orders.next();

            if (foundOrder.billingAddress.postalCode.toUpperCase() !== orderPostalCode.toUpperCase() || foundOrder.customerEmail !== orderFormEmail) {
                 app.getView('Login', {
                    OrderNotFound: true
                }).render();
                return;
            }

            app.getView({
                Order: foundOrder
            }).render('account/orderhistory/orderdetails');
        },
        search: function () {
            app.getController('GiftRegistry').SearchGiftRegistry();
            return;
        },
        error: function () {
            app.getView('Login').render();
            return;
        }
    });

}

/**
 * Form handler for the oauthlogin form. Handles the following actions:
 * - __login__ - Starts the process of authentication via an external OAuth2 provider.
 * Uses the OAuthProvider property in the httpParameterMap to determine which provider to initiate authentication with.
 * Redirects to the provider web page where the customer initiates the actual user authentication.
 * If no provider page is available, renders the LoginView.
 * - __error__ - renders the LoginView.
 */
function handleOAuthLoginForm() {
    var oauthLoginForm = app.getForm('oauthlogin');
    oauthLoginForm.handleAction({
        login: function () {
            if (request.httpParameterMap.OAuthProvider.stringValue) {
                session.custom.RememberMe = request.httpParameterMap.rememberme.booleanValue || false;
                session.custom.ContinuationURL = getTargetUrl().toString();

                var initiateOAuthLoginResult = new Pipelet('InitiateOAuthLogin').execute({
                    OAuthProviderID: request.httpParameterMap.OAuthProvider.stringValue
                });
                if (initiateOAuthLoginResult.result === PIPELET_ERROR || initiateOAuthLoginResult.AuthorizationURL === null) {
                    oauthLoginForm.get('loginsucceeded').invalidate();

                    // Show login page with error.
                    app.getView('Login').render();
                    return;
                }

                response.redirect(initiateOAuthLoginResult.AuthorizationURL);
            }
            return;
        },
        error: function () {
            app.getView('Login').render();
            return;
        }
    });
}

/**
 * Determines whether the request has an OAuth provider set. If it does, calls the
 * {@link module:controllers/Login~handleOAuthLoginForm|handleOAuthLoginForm} function,
 * if not, calls the {@link module:controllers/Login~handleLoginForm|handleLoginForm} function.
 */
function processLoginForm () {
    if (request.httpParameterMap.OAuthProvider.stringValue) {
        handleOAuthLoginForm();
    } else {
        handleLoginForm();
    }
}


/**
 * This is a central place to login a user from the login form.
 * @deprecated Only kept until all controllers are migrated, as functionality has been moved to other methods
 */
function process() {
    // handle OAuth login
    if (request.httpParameterMap.OAuthProvider.stringValue) {
        session.custom.RememberMe = request.httpParameterMap.rememberme.booleanValue || false;
        session.custom.ContinuationURL = URLUtils.https('Login-OAuthReentry').toString();

        var initiateOAuthLoginResult = new Pipelet('InitiateOAuthLogin').execute({
            OAuthProviderID: request.httpParameterMap.OAuthProvider.stringValue
        });

        if (initiateOAuthLoginResult.result === PIPELET_ERROR) {
            var oauthLoginForm = app.getForm('oauthlogin.');
            oauthLoginForm.get('loginsucceeded').invalidate();
            finishOAuthLogin();
            return false;
        }

        response.redirect(initiateOAuthLoginResult.AuthorizationURL);

        return false;
    } else {
         // handle 'normal' login
        var loginForm = app.getForm('login');

        var success = Customer.login(loginForm.getValue('username'), loginForm.getValue('password'), loginForm.getValue('rememberme'));

        if (!success) {
            loginForm.get('loginsucceeded').invalidate();
        } else {
            loginForm.clear();
        }
        return success;
    }
}
/**
 * Invalidates the oauthlogin form.
 * Calls the {@link module:controllers/Login~finishOAuthLogin|finishOAuthLogin} function.
*/
function oAuthFailed() {
    app.getForm('oauthlogin').get('loginsucceeded').invalidate();
    finishOAuthLogin();
}
/**
 * Clears the oauthlogin form.
 * Calls the {@link module:controllers/Login~finishOAuthLogin|finishOAuthLogin} function.
*/
function oAuthSuccess() {
    app.getForm('oauthlogin').clear();
    finishOAuthLogin();
}
/**
 * This function is called after authentication by an external oauth provider.
 * If the user is successfully authenticated, the provider returns an authentication code,
 * this function exchanges the code for a token and with that token requests  the user information specified by
 *  the configured scope (id, first/last name, email, etc.) from the provider.
 * If the token exchange succeeds, calls the {@link module:controllers/Login~oAuthSuccess|oAuthSuccess} function.
 * If the token exchange fails, calls the {@link module:controllers/Login~oAuthFailed|oAuthFailed} function.
 * The function also handles multiple error conditions and logs them.
*/
function handleOAuthReentry() {
    var FinalizeOAuthLoginResult = new Pipelet('FinalizeOAuthLogin').execute();
    if (FinalizeOAuthLoginResult.result === PIPELET_ERROR) {
        oAuthFailed();
        return;
    }
    var responseText = FinalizeOAuthLoginResult.ResponseText;
    var oAuthProviderID = FinalizeOAuthLoginResult.OAuthProviderID;
    var accessToken = FinalizeOAuthLoginResult.AccessToken;
    // var refreshToken = FinalizeOAuthLoginResult.RefreshToken;
    // var accessTokenExpiry = FinalizeOAuthLoginResult.AccessTokenExpiry;
    // var errorStatus = FinalizeOAuthLoginResult.ErrorStatus;


    if (null === oAuthProviderID) {
        LOGGER.warn('OAuth provider id is null.');
        oAuthFailed();
        return;
    }
    LOGGER.debug('{0} response:\n{1}', oAuthProviderID, responseText);
    if (null !== responseText) {
        //whether to drop the rememberMe cookie (preserved in the session before InitiateOAuthLogin pipelet)
        var rememberMe = session.custom.RememberMe;
        delete session.custom.RememberMe;

        // LinkedIn returns XML.
        var extProfile = {};
        if (oAuthProviderID === 'LinkedIn') {
            var responseReader = new dw.io.Reader(responseText);
            var xmlStreamReader = new dw.io.XMLStreamReader(responseReader);
            while (xmlStreamReader.hasNext()) {
                if (xmlStreamReader.next() === dw.io.XMLStreamConstants.START_ELEMENT) {
                    var localElementName = xmlStreamReader.getLocalName();
                    // Ignore the top level person element and read the rest into a plain object.
                    if (localElementName !== 'person') {
                        extProfile[localElementName] = xmlStreamReader.getElementText();
                    }
                }
            }
            xmlStreamReader.close();
            responseReader.close();
        } else {
            // All other providers return JSON.
            extProfile = JSON.parse(responseText);
            if (null === extProfile) {
                LOGGER.warn('Data could not be extracted from the response:\n{0}', responseText);
                oAuthFailed();
                return;
            }
            if (oAuthProviderID === 'VKontakte') {
                // They use JSON, but thought it would be cool to add some extra top level elements
                extProfile = extProfile.response[0];
            }
        }

        // This is always id or uid for all providers.
        var userId = extProfile.id || extProfile.uid;
        if (!userId) {
            LOGGER.warn('Undefined user identifier - make sure you are mapping the correct property from the response.' +
                ' We are mapping "id" which is not available in the response: \n', extProfile);
            oAuthFailed();
            return;
        }
        LOGGER.debug('Parsed UserId "{0}" from response: {1}', userId, JSON.stringify(extProfile));

        if (oAuthProviderID === 'SinaWeibo') {
            // requires additional requests to get the info
            extProfile = getSinaWeiboAccountInfo(accessToken, userId);
        }

        var profile = dw.customer.CustomerMgr.getExternallyAuthenticatedCustomerProfile(oAuthProviderID, userId);
        var customer;

        if (profile === null) {
            Transaction.wrap(function () {
                LOGGER.debug('User id: ' + userId + ' not found, creating a new profile.');
                customer = dw.customer.CustomerMgr.createExternallyAuthenticatedCustomer(oAuthProviderID, userId);
                profile = customer.getProfile();
                var firstName, lastName, email;

                // Google comes with a 'name' property that holds first and last name.
                if (typeof extProfile.name === 'object') {
                    firstName = extProfile.name.givenName;
                    lastName = extProfile.name.familyName;
                } else {
                    // The other providers use one of these, GitHub & SinaWeibo have just a 'name'.
                    firstName = extProfile['first-name'] || extProfile.first_name || extProfile.name;
                    lastName = extProfile['last-name'] || extProfile.last_name || extProfile.name;
                }
                // Simple email addresses.
                email =  extProfile['email-address'] || extProfile.email;
                if (!email) {
                    var emails = extProfile.emails;
                    // Google comes with an array
                    if (emails && emails.length) {
                        //First element of the array is the account email according to Google.
                        profile.setEmail(extProfile.emails[0].value);
                    // While MS comes with an object.
                    } else {
                        email = emails.preferred || extProfile['emails.account'] || extProfile['emails.personal'] ||
                            extProfile['emails.business'];
                    }
                }
                LOGGER.debug('Updating profile with "{0} {1} - {2}".',firstName, lastName,email);
                profile.setFirstName(firstName);
                profile.setLastName(lastName);
                profile.setEmail(email);
            });
        } else {
            customer = profile.getCustomer();
        }
        var credentials = profile.getCredentials();
        if (credentials.isEnabled()) {
            Transaction.wrap(function () {
                dw.customer.CustomerMgr.loginExternallyAuthenticatedCustomer(oAuthProviderID, userId, rememberMe);
            });
            LOGGER.debug('Logged in external customer with id: {0}', userId);
        } else {
            LOGGER.warn('Customer attempting to login into a disabled profile: {0} with id: {1}',
                profile.getCustomer().getCustomerNo(), userId);
            oAuthFailed();
            return;
        }
    } else {
        LOGGER.warn('Response from provider is empty');
        oAuthFailed();
        return;
    }


    oAuthSuccess();
}

/**
 * Get Sina Weibo account via additional requests.
 * Also handles multiple error conditions and logs them.
 * @param  {String} accessToken The OAuth access token.
 * @param  {String} userId      The OAuth user ID.
 * @return {Object}             Account information.
 * @todo Migrate httpClient calls to dw.svc.*
 */
function getSinaWeiboAccountInfo(accessToken, userId) {
    var name, email;
    if (null === accessToken) {
        LOGGER.warn('Exiting because the AccessToken input parameter is null.');
        return null;
    }
    var accessTokenSuffix = '?access_token=' + accessToken;
    var http = new dw.net.HTTPClient();
    http.setTimeout(30000); //30 secs

    //Obtain the name:
    //http://open.weibo.com/wiki/2/users/show/en -> https://api.weibo.com/2/users/show.json
    var urlUser = 'https://api.weibo.com/2/users/show.json' + accessTokenSuffix +
        '&uid=' + userId;
    http.open('GET', urlUser);
    http.send();
    var resultName  = http.getText();
    if (200 !== http.statusCode) {
        LOGGER.warn('Got an error calling:' + urlUser +
            '. The status code is:' + http.statusCode + ' ,the text is:' + resultName +
            ' and the error text is:' + http.getErrorText());
        return null;
    } else {
        var weiboUser = JSON.parse(resultName);
        if (null === weiboUser) {
            LOGGER.warn('Name could not be extracted from the response:' + resultName);
            return null;
        } else {
            name = weiboUser.name;
        }
    }

    //Obtain the email:
    //http://open.weibo.com/wiki/2/account/profile/email -> https://api.weibo.com/2/account/profile/email.json
    var urlEmail  = 'https://api.weibo.com/2/account/profile/email.json' + accessTokenSuffix;
    http.open('GET', urlEmail);
    http.send();
    var resultEmail  = http.getText();
    if (200 !== http.statusCode) {//!
        LOGGER.warn('Email could not be retrieved. Got an error calling:' + urlUser +
            '. The status code is:' + http.statusCode + ' ,the text is:' + resultEmail +
            ' and the error text is:' + http.getErrorText() +
            '. Make sure your application is authorized by Weibo to request email info (usually need to be successfully audited by them.)');
    } else {
        var weiboEmail  = JSON.parse(resultEmail);// in the format: ('[{"Email": "weibo_api_tech@sina.com"}]');
        if (null === weiboEmail) {
            LOGGER.warn('Email could not be extracted from the response:' + resultEmail);
        } else {
            var emails  = weiboEmail;
            if (emails && 0 < emails.length) {
                //first element of the array would be the account email according to Google:
                email = emails[0].Email;
            }
        }
    }
    return {name: name, email: email};
}

/**
 * Internal helper function to finish the OAuth login.
 * Redirects user to the location set in either the
 * {@link module:controllers/Login~handleOAuthLoginForm|handleOAuthLoginForm} function or
 * {@link module:controllers/Login~process|process} function.
 */
function finishOAuthLogin() {
    // To continue to the destination that is already preserved in the session.
    var location = session.custom.ContinuationURL;
    delete session.custom.ContinuationURL;
    response.redirect(location);
}
/**
 * Logs the customer out and clears the login and profile forms.
 * Calls the {@link module:controllers/Account~Show|Account controller Show function}.
 */
function Logout() {
    Customer.logout();

    app.getForm('login').clear();
    app.getForm('profile').clear();


    //Cart.get().calculate();

    response.redirect(URLUtils.https('Account-Show'));
    return;
}

/*
 * Web exposed methods
 */
/** Contains the login page preparation and display.
 * @see module:controllers/Login~show */
exports.Show                    = guard.ensure(['https'], show);
/** Determines whether the request has an OAuth provider set.
 * @see module:controllers/Login~processLoginForm */
exports.LoginForm               = guard.ensure(['https','post'], processLoginForm);
/** Form handler for the oauthlogin form.
 * @see module:controllers/Login~handleOAuthLoginForm */
exports.OAuthLoginForm          = guard.ensure(['https','post'], handleOAuthLoginForm);
/** Exchanges a user authentication code for a token and requests user information from an OAUTH provider.
 * @see module:controllers/Login~handleOAuthReentry */
exports.OAuthReentry            = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryLinkedIn    = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryGoogle      = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryGooglePlus  = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryMicrosoft   = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryFacebook    = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryGitHub      = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentrySinaWeibo   = guard.ensure(['https','get'], handleOAuthReentry);
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.OAuthReentryVKontakte   = guard.ensure(['https','get'], handleOAuthReentry);
/** Contains the login page preparation and display.
 * @see module:controllers/Login~show */
exports.Logout                  = guard.all(Logout);

/*
 * Local methods
 */
/** @deprecated This is only kept for compatibility reasons, use {@link module:controllers/Login~handleOAuthReentry|handleOAuthReentry} instead */
exports.Process                 = process;
