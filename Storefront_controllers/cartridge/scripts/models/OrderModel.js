'use strict';

/**
* Module for ordering functionality.
* @module models/OrderModel
*/

/* API Includes */
var AbstractModel = require('./AbstractModel');
var ArrayList = require('dw/util/ArrayList');
var OrderMgr = require('dw/order/OrderMgr');

/**
 * Order helper class providing enhanced order functionality.
 * @class module:models/OrderModel~OrderModel
 * @extends module:models/AbstractModel
 *
 * @param {dw.order.Order} obj The order object to enhance/wrap.
 */
var OrderModel = AbstractModel.extend(
    /** @lends module:models/OrderModel~OrderModel.prototype */
    {
        /**
         * Creates gift certificates for all gift certificate line items in the order.
         *
         * @alias module:models/OrderModel~OrderModel/createGiftCertificates
         * @returns {dw.util.ArrayList} List containing all created gift certificates, null in case of an error.
         */
        createGiftCertificates: function () {

            var giftCertificates = new ArrayList();
            var giftCertificateLineItems = this.getGiftCertificateLineItems();

            for (var i = 0; i < giftCertificateLineItems.length; i++) {
                var giftCertificateLineItem = giftCertificateLineItems[i];

                var CreateGiftCertificateResult = new dw.system.Pipelet('CreateGiftCertificate').execute({
                    Amount: giftCertificateLineItem.netPrice.value,
                    RecipientEmail: giftCertificateLineItem.recipientEmail,
                    RecipientName: giftCertificateLineItem.recipientName,
                    SenderName: giftCertificateLineItem.senderName,
                    GiftCertificateLineItem: giftCertificateLineItem,
                    Message: giftCertificateLineItem.message,
                    OrderNo: this.getOrderNo()
                });
                if (CreateGiftCertificateResult.result === PIPELET_ERROR) {
                    return null;
                }

                giftCertificates.add(CreateGiftCertificateResult.GiftCertificate);
            }

            return giftCertificates;
        }

    });

/**
 * Gets a new instance for a given order or order number.
 *
 * @alias module:models/OrderModel~OrderModel/get
 * @param parameter {dw.order.Order | String} The order object to enhance/wrap or the order ID of the order object.
 * @returns {module:models/OrderModel~OrderModel}
 */
OrderModel.get = function (parameter) {
    var obj = null;
    if (typeof parameter === 'string') {
        obj = OrderMgr.getOrder(parameter);
    } else if (typeof parameter === 'object') {
        obj = parameter;
    }
    return new OrderModel(obj);
};

/** The order class */
module.exports = OrderModel;
