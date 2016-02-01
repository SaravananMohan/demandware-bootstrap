'use strict';
/**
 * Model for product variation functionality.
 * @module models/ProductVariationModel
 */

/* API Includes */
var AbstractModel = require('./AbstractModel');
var HashMap = require('dw/util/HashMap');

/**
 * ProductVariationModel helper class providing enhanced profile functionality
 * @class module:models/ProductVariationModel~ProductVariationModel
 */
var ProductVariationModel = AbstractModel.extend({
    /** @lends module:models/ProductVariationModel~ProductVariationModel.prototype */
    /**
     * Gets a new instance for a given product variation model.
     * @alias module:models/ProductVariationModel~ProductVariationModel/init
     * @param parameter method of of super class to call.
     */
    init: function (parameter) {
        var instance = this._super(parameter);
        this.initProperties();
        this.selectionMap = new HashMap();
        return instance;
    },

    /**
     * Updates the model with the given variation attribute to the given value.
     *
     * @alias module:models/ProductVariationModel~ProductVariationModel/setSelectedVariationValue
     * @param {dw.catalog.ProductVariationAttrbute} variationAttribute - the attribute
     * @param {dw.catalog.ProductVariationAttrbuteValue} variationAttributeValue - the variation attribute value
     */

    // Please see https://intranet.demandware.com/jira/browse/RAP-4424
    // If cannot remove this override, should be able to replace the function body with:
    // this.object.setSelectedVariationValue(variationAttribute.ID, variationAttributeValue.ID);
    setSelectedVariationValue: function (variationAttribute, variationAttributeValue) {
        this.selectionMap.put(variationAttribute.ID, variationAttributeValue.ID);
    },

    /**
     * Gets the currently selected variant or null if no variant is selected.
     *
     * @alias module:models/ProductVariationModel~ProductVariationModel/getSelectedVariant
     * @return {dw.catalog.Variant} the selected variant.
     */
    getSelectedVariant: function () {
        var filteredList = this.object.getVariants(this.selectionMap);
        if (this.selectionMap.size() === this.productVariationAttributes.size() && filteredList.size() === 1) {
            return filteredList[0];
        }
        return null;
    },

    /**
     * Checks if the given attribute/value combination is currently selected.
     *
     * @alias module:models/ProductVariationModel~ProductVariationModel/isSelectedAttributeValue
     * @param {dw.catalog.ProductVariationAttrbute} variationAttribute - the attribute
     * @param {dw.catalog.ProductVariationAttrbuteValue} variationAttributeValue - the variation attribute value
     * @returns {Boolean} true if the value is selected
     */
    isSelectedAttributeValue: function (variationAttribute, variationAttributeValue) {
        return this.selectionMap.get(variationAttribute.ID) === variationAttributeValue.ID;
    },

    /**
     * Returns the ProductVariationAttrbuteValue object for the given attribute and the value ID.
     *
     * @alias module:models/ProductVariationModel~ProductVariationModel/getVariationAttributeValue
     * @param {dw.catalog.ProductVariationAttrbute} variationAttribute - the attribute
     * @param {String} variationAttributeValueID - the variation attribute value ID
     */
    getVariationAttributeValue: function (variationAttribute, variationAttributeValueID) {
        if (variationAttributeValueID) {
            var allValues = this.object.getAllValues(variationAttribute);
            for (var i = 0; i < allValues.length; i++) {
                if (allValues[i].ID === variationAttributeValueID) {
                    return allValues[i];
                }
            }
        }
        return null;
    },

    /**
     * Gets the currently selected value for a given attribute.
     *
     * @param  {dw.catalog.ProductVariationAttrbute} variationAttribute the attribute
     * @return {dw.catalog.ProductVariationAttrbuteValue} the attribute value or null
     */
    getSelectedValue: function (variationAttribute) {
        if (variationAttribute) {
            return this.getVariationAttributeValue(variationAttribute, this.selectionMap.get(variationAttribute.ID));
        }
        return null;
    },


    // Please see https://intranet.demandware.com/jira/browse/RAP-4424
    urlSelectVariationValue: function (action, variationAttribute, variationAttributeValue) {
        var url = this.object.urlSelectVariationValue(action, variationAttribute, variationAttributeValue);
        return _generateUrl(url, this);
    },


    // Please see https://intranet.demandware.com/jira/browse/RAP-4424
    urlUnselectVariationValue: function (action, variationAttribute) {
        var url = this.object.urlUnselectVariationValue(action, variationAttribute);
        return _generateUrl(url, this, variationAttribute.attributeID);

    },


    // Please see https://intranet.demandware.com/jira/browse/RAP-4424
    /**
     * Unfortunately, we need to override this function as the instance has no way of updating
     * the selected variations with Controllers.  We can, however, mimic a ProductVariationMaster
     * with updated selected variations by calling ProductVariationMaster.getVariants() with a
     * HashMap of the known selected attributes, as well as with any other attribute under
     * consideration.
     *
     * @param {dw.catalog.ProductVariationAttribute} attr - attribute type
     * @param {dw.catalog.ProductVariationAttributeValue} value - attribute value
     */
    hasOrderableVariants: function (attr, value) {
        var lookupMap = this.selectionMap.clone();
        var variant;
        var variantsIter;
        var variationModel;

        lookupMap.put(attr.attributeID, value.value);
        variantsIter = this.object.getVariants(lookupMap).iterator();

        if (variantsIter.hasNext()) {
            variant = variantsIter.next();
            variationModel = variant.masterProduct.variationModel;
            return variationModel.hasOrderableVariants(attr, value);
        }
    },

    /**
     * Overrides the ProductVariationModel.getImage() function which accepts 1-3 arguments.  Please refer to
     * the Class ProductVariationModel page on https://documentation.demandware.com for more info.
     *
     * @param {...number} var_args
     * @returns {dw.content.MediaFile}
     */
    getImage: function () {
        var firstVariant = _getFirstMatchingVariant(this.object, this.selectionMap);

        if (3 === arguments.length) {
            return firstVariant.variationModel.getImage(arguments[0], arguments[1], arguments[2]);
        }

        return firstVariant.getImage(arguments[0], arguments[1]);
    },

    getImages: function (viewtype) {
        return _getFirstMatchingVariant(this.object, this.selectionMap).getImages(viewtype);
    }
});


// Please see https://intranet.demandware.com/jira/browse/RAP-4424
function _generateUrl(url, pvm, attrId) {
    var params = request.httpParameterMap;
    var customFormPrefix = params.hasOwnProperty('CustomFormPrefix') ? params.CustomFormPrefix.stringValue : undefined;
    var entrySet = pvm.selectionMap.entrySet();

    for (var i = 0; i < entrySet.length; i++) {
        var entry = entrySet[i];
        var urlKey = customFormPrefix ? customFormPrefix + '_' : 'dwvar_';
        urlKey += pvm.object.master.ID + '_' + entry.key;

        if (url.indexOf(urlKey) === -1) {
            if (url.indexOf('?') === -1) {
                url += '?';
            } else {
                url += '&';
            }

            url += urlKey + '=';
            if (entry.key !== attrId) {
                url += entry.value;
            }
        }
    }
    return url;
}

function _getFirstMatchingVariant (variationModel, selectionMap) {
    var variantsIter = variationModel.getVariants(selectionMap).iterator();
    var firstVariant;

    if (variantsIter.hasNext()) {
        firstVariant = variantsIter.next();
    }

    return firstVariant;
}

/** The model class */
module.exports = ProductVariationModel;
