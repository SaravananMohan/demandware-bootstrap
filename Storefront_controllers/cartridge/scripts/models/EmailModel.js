'use strict';

/**
 * Model for email functionality. Creates an EmailModel class with methods to prepare and get email.
 *
 * @module models/EmailModel
 */

/* API Includes */
var AbstractModel = require('./AbstractModel');

/**
 * Email helper providing enhanced email functionality
 * @class module:models/EmailModel~EmailModel
 *
 * @extends module:models/AbstractModel
 * @extends dw.net.Mail
 * @example
 * require('~/models/EmailModel').get('mail/resetpasswordemail', Customer.profile.email)
 *     .setSubject(dw.web.Resource.msg('email.passwordassistance', 'email', null)).send({
 *          Customer : Customer,
 *          ResetPasswordToken : ResetPasswordToken
 *     });
 *
 * @param {String} template The template that is rendered and then sent as email.
 * @param {String} recipient The email address where the text of the rendered template is sent.
 */
var EmailModel = AbstractModel.extend(
    /** @lends module:models/EmailModel~EmailModel.prototype */
    {
        template: null,

        init: function (template, recipient) {
            this._super(new dw.net.Mail());
            this.template = template;

            // prepare the email object
            var mail = this.object;
            mail.addTo(recipient);
            mail.setFrom(dw.system.Site.getCurrent().getCustomPreferenceValue('customerServiceEmail') || 'no-reply@demandware.com');
        },

        /**
         * Prepares the email that is queued to the internal mail system for delivery.
         *
         * @alias module:models/EmailModel~EmailModel/send
         * @param args JSON object added to the HashMap used when rendering the email template.
         * @returns {dw.system.Status} Status tells whether the mail was successfully queued ( Status.OK) or not ( Status.ERROR).
         * If an error is thrown, more information about the reason for the failure can be found within the log files.
         * If the mandatory fields from, content, and subject are empty an IllegalArgumentException is thrown. An
         * llegalArgumentException is thrown if neither to, cc, nor bcc are set.
         */
        send: function (args) {
            // Add some default keys
            var params = require('~/cartridge/scripts/object').toHashMap(args);
            params.CurrentForms = session.forms;
            params.CurrentHttpParameterMap = request.httpParameterMap;
            params.CurrentCustomer = customer;

            // Creates a body template. Renders the template using the params HashMap.
            var contentTemplate = new dw.util.Template(this.template);
            params.put('MainContent', contentTemplate.render(params).text);

            // @TODO Enable this to allow for a shared pt_email which creates consistent header/footer
            // integrate the body in the global content
            //var template = new dw.util.Template('mail/pt_email');
            //var content = template.render(params);

            // Sets the content and sends it.
            this.object.setContent(params.MainContent, 'text/html', 'UTF-8');
            return this.object.send();
        },

        __noSuchMethod__: function (methodName, methodArgs) {
            var result = this._super(methodName, methodArgs);
            return result === this.object ? this : result;
        }
    });

/**
 * Gets a wrapped email instance.
 *
 * @alias module:models/EmailModel~EmailModel/get
 * @param {String} template The template that is rendered and sent as email.
 * @param {String} recipient The email address where the text of the rendered template is sent.
 * @returns {module:models/EmailModel~EmailModel}
 */
EmailModel.get = function (template, recipient) {
    return new EmailModel(template, recipient);
};

/** The Email Model class */
module.exports = EmailModel;
