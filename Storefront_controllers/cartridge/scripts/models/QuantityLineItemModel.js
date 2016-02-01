'use strict';

/**
 * Model for quantity line items.
 * @module models/QuantityLineItemModel */
var Class = require('~/cartridge/scripts/util/Class').Class;

/* API Includes */
var Quantity = require('dw/value/Quantity');

/**
 * Helper object to store ProductLineItem information for each quantity. Used in multishipping checkout to save
 * creation of new PLIs for each quantity.
 *
 * @class module:models/QuantityLineItemModel~QuantityLineItemModel
 * @extends module:util/Class
 *
 * @param {dw.order.ProductLineItem} pli The ProductLineItem to create the QuantityLineItem from.
 */
var QuantityLineItemModel = Class.extend(
    /** @lends module:models/QuantityLineItemModel~QuantityLineItemModel.prototype */
    {
        /** */
        productID: null,
        /** */
        lineItemText: null,
        /** */
        quantity: null,
        /** */
        pliUUID: null,
        /** */
        optionID: null,

        init: function (pli) {

            this.quantity = new Quantity(1, pli.quantity.getUnit());
            this.lineItemText = pli.lineItemText;
            this.productID = pli.productID;
            this.pliUUID = pli.UUID;

            //Persists the optionID. If the product does not have an option, it is set to 'na'.
            if (pli.optionProductLineItems.size() > 0) {
                for (var iter = pli.optionProductLineItems.iterator(); iter.hasNext();) {
                    var item = iter.next();
                    this.optionID = item.optionValueID;
                }
            } else {
                this.optionID = 'na';
            }

        }

    });

/** The QuantityLineItem class */
module.exports = QuantityLineItemModel;
