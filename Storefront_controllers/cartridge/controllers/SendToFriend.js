'use strict';

/**
 * Controller for legacy send-to-a-friend feature.
 * @module controllers/SendToFriend */

/* API Includes */
var ISML = require('dw/template/ISML');

/* Script Modules */
var guard = require('~/cartridge/scripts/guard');

/**
 * Renders a dialog to gather email info to send to a friend.
 * A template that uses this dialog can set some of the values ahead of
 * time. Please look at wishlist.isml or registry.isml for examples.
 *
 */
function Start() {

    // because the customer is not known and anonymous
    // seems to be cause by JavaScript dialogs which do not sent HTTP cookies correctly

    var CurrentHttpParameterMap = request.httpParameterMap;
    var sendToFriendForm = session.forms.sendtofriend;

    session.forms.sendtofriend.clearFormElement();

    var Product = null;
    var ProductOptionModel = null;

    if (CurrentHttpParameterMap.pid.stringValue) {
        Product = dw.catalog.ProductMgr.getProduct(CurrentHttpParameterMap.pid);

        var UpdateProductOptionSelectionsResult = new dw.system.Pipelet('UpdateProductOptionSelections').execute({
            Product: Product
        });
        ProductOptionModel = UpdateProductOptionSelectionsResult.ProductOptionModel;
    }


    /*
     * var ProductList = null;
     *
     * if (CurrentHttpParameterMap.plid.stringValue) { var GetProductListResult =
     * new dw.system.Pipelet('GetProductList', { Create : false }).execute({
     * ProductListID : CurrentHttpParameterMap.plid.value }); ProductList =
     * GetProductListResult.ProductList; }
     */

    if (customer.authenticated) {
        sendToFriendForm.yourname.htmlValue = customer.profile.firstName + ' ' + customer.profile.lastName;
    }

    ISML.renderTemplate('account/components/sendtofrienddialog', {
        ViewMode: 'Edit',
        Product: Product,
        ProductOptionModel: ProductOptionModel,
        ContinueURL: dw.web.URLUtils.https('SendToFriend-SendToFriendForm')
    });
}

/**
 * The event handler for the send-to-a-friend feature.
 * If the formId is:
 * - __edit__ - sets the ContinueURL to SendToFriend-SendToFriendForm and renders the send-to-a-friend dialog (account/components/sendtofrienddialog).
 * - __preview__ - validates whether the same email address was entered for 'friends email' and 'confirm friends email' fields and renders the
 * send-to-a-friend dialog (account/components/sendtofrienddialog) in preview mode.
 * - __send__ - calls the {@link module:controllers/SendToFriend~send|send} function.
 * If no formId is present, behaves identically to the edit action.
 */
function SendToFriendForm() {

    // but sometimes this is called with GET and not with POST
    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'edit') {
            ISML.renderTemplate('account/components/sendtofrienddialog', {
                ViewMode: 'Edit',
                ContinueURL: dw.web.URLUtils.https('SendToFriend-SendToFriendForm')
            });
            return;
        } else if (TriggeredAction.formId === 'preview') {
            var pid = request.httpParameterMap.pid;

            var sendToFriendForm = session.forms.sendtofriend;

            if (sendToFriendForm.friendsemail.value !== sendToFriendForm.confirmfriendsemail.value) {
                sendToFriendForm.confirmfriendsemail.invalidateFormElement();
            }

            var Product = null;
            var ProductOptionModel = null;

            if (typeof (pid) !== 'undefined' && pid !== null) {
                var GetProductResult = getProduct(pid);
                Product = GetProductResult.Product;
                ProductOptionModel = GetProductResult.ProductOptionModel;
            }

            ISML.renderTemplate('account/components/sendtofrienddialog', {
                ViewMode: 'preview',
                Product: Product,
                ProductOptionModel: ProductOptionModel,
                ContinueURL: dw.web.URLUtils.https('SendToFriend-SendToFriendForm')
            });
            return;
        } else if (TriggeredAction.formId === 'send') {
            send();
            return;
        }
    }


    /*
     if (session.forms.sendtofriend.valid)
     {
     send();
     return;
     }
     */


    ISML.renderTemplate('account/components/sendtofrienddialog', {
        ContinueURL: dw.web.URLUtils.https('SendToFriend-SendToFriendForm')
    });
}
/**
 * Sends the email from the customer to their friend containing product information.
 */
function send() {
    var CurrentHttpParameterMap = request.httpParameterMap;
    var pid = request.httpParameterMap.pid;
    var ProductList;

    var sendToFriendForm = session.forms.sendtofriend;

    if (sendToFriendForm.friendsemail.value !== sendToFriendForm.confirmfriendsemail.value) {
        sendToFriendForm.confirmfriendsemail.invalidateFormElement();


        ISML.renderTemplate('account/components/sendtofrienddialog', {
            ContinueURL: dw.web.URLUtils.https('SendToFriend-SendToFriendForm')
        });
        return;
    }

    /*
     * Product List Email
     */

    if (typeof (ProductList) !== 'undefined' && ProductList !== null) {
        require('~/cartridge/scripts/models/EmailModel').get('mail/productlist', sendToFriendForm.friendsemail.value)
            .setSubject(sendToFriendForm.subject.value)
            .setFrom(customer.profile.email).send();


        if (empty(CurrentHttpParameterMap.format.stringValue)) {
            if (empty(ProductList.eventCity)) {
                var WishlistController = require('./Wishlist');
                WishlistController.Show();
                return;
            } else {
                var GiftRegistryController = require('./GiftRegistry');
                GiftRegistryController.ShowRegistry();
                return;
            }
        } else {
            ISML.renderTemplate('account/components/sendtofrienddialogsuccess', {
                ViewMode: 'edit'
            });
            return;
        }
    }

    /*
     * Product Email
     */
    if (typeof (pid) !== 'undefined' && pid !== null) {

        require('~/cartridge/scripts/models/EmailModel').get('mail/product', sendToFriendForm.friendsemail.value)
            .setSubject(sendToFriendForm.subject.value)
            .setFrom(customer.profile.email).send();

        if (empty(CurrentHttpParameterMap.format.stringValue)) {
            var ProductController = require('./Product');
            ProductController.Show();
            return;
        }
    } else {
        /*
         * Default
         */
        require('~/cartridge/scripts/models/EmailModel').get('mail/productlistdefault', sendToFriendForm.friendsemail.value)
            .setSubject(sendToFriendForm.subject.value)
            .setFrom(customer.profile.email).send();

    }

    ISML.renderTemplate('account/components/sendtofrienddialogsuccess', {
        ViewMode: 'edit'
    });
}

/**
 * Gets a product and any selected product options.
 */
function getProduct(pid) {
    var GetProductResult = new dw.system.Pipelet('GetProduct').execute({
        ProductID: pid.stringValue
    });
    if (GetProductResult.result === PIPELET_ERROR) {
        return {
            error: true
        };
    }
    var Product = GetProductResult.Product;

    var UpdateProductOptionSelectionsResult = new dw.system.Pipelet('UpdateProductOptionSelections').execute({
        Product: Product
    });
    var ProductOptionModel = UpdateProductOptionSelectionsResult.ProductOptionModel;

    return {
        Product: Product,
        ProductOptionModel: ProductOptionModel
    };
}

/**
 * Ensures that storefront users using the send-to-a-friend feature are logged in.
 * @FIXME shouldn't this be controlled through a guard?
 */
function Login() {
    var accountController = require('./Account');
    accountController.requireLogin({
        TargetAction: 'SendToFriend-Start',
        TargetParameters: ['pid', request.httpParameterMap.pid.stringValue]
    });
}

/*
 * Module exports
 */

/*
 * Web exposed methods
 */
/** Renders a dialog to gather email info to send to a friend.
 * @see module:controllers/SendToFriend~Start */
exports.Start = guard.ensure(['https', 'get'], Start);
/** The event handler for the send-to-a-friend feature
 * @see module:controllers/SendToFriend~SendToFriendForm */
exports.SendToFriendForm = guard.ensure(['https'], SendToFriendForm);
/** Ensures that storefront users using the send-to-a-friend feature are logged in.
 * @see module:controllers/SendToFriend~Login */
exports.Login = guard.ensure(['https'], Login);