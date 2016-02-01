'use strict';

/**
 * Model for product functionality.
 * @module models/ProductModel
 */

var AbstractModel = require('./AbstractModel');
var app = require('~/cartridge/scripts/app');

/**
 * Product helper providing enhanced product functionality
 * @class module:models/ProductModel~ProductModel
 * @extends module:models/AbstractModel
 *
 * @param {dw.catalog.Product} obj - The product object to enhance and wrap.
 */
var ProductModel = AbstractModel.extend(
    /** @lends module:models/ProductModel~ProductModel.prototype */
    {
         /**
         * Processes variation value selections and calculates and returns the ProductVariationModels
         * for one or multiple products. The function uses the given HttpParameterMap, so the request parameters do not
         * need to be passed in. Variation value selections must be specified as HTTP parameters in the following form:
         * <pre>{prefix_}{pid}_varAttrID={varAttrValueID}</pre>
         *
         * A custom prefix can be set using the <code>optionalCustomPrefix</code> parameter.
         * Otherwise, the default prefix <code>dwvar_</code> is used. {pid}is the product id.
         *
         * Example: <pre>dwvar_PN00050_color=red</pre>
         *
         * For each product specified as {pid}, a ProductVariationModel instance is created and returned as an element of the
         * "ProductVariationModels" HashMap return parameter. The function processes variation attributes in their defined order
         * and ignores attributes or values not defined for a variation. The function returns a map of ProductVariationModels
         * with the product instance as the key and the ProductVariationModel as the value. For backwards compatibility reasons,
         * the function accepts an optional Product instance as an input parameter. The product may either be a master or a variant.
         *
         * If specified, the function returns the ProductVariationModel for this product as "ProductVariationModel" and also as
         * an element of the "ProductVariationModels" HashMap parameter. Also, the system tries to find a variant that matches
         * the attributes selected in the HttpParameterMap as closely as possible. The matching product is returned under the
         * key "SelectedProduct". If the passed product is neither a master or a variant, then the product itself is simply
         * returned under the key "SelectedProduct". No value is returned under the "SelectedProduct" key unless a Product
         * instance was passed to the function.
         *
         * @alias module:models/ProductModel~ProductModel/updateVariationSelection
         * @param parameterMap {dw.web.HttpParameterMap} Variation value selections as HTTP parameters.
         * @param optionalCustomPrefix {String} Optional prefix for HTTP parameters. If nothing is passed, the default prefix "dwvar_" is assumed.
         *
         * @returns {dw.catalog.ProductVariationModel}
         */
        updateVariationSelection: function (parameterMap, optionalCustomPrefix) {
            var formPrefix = optionalCustomPrefix || 'dwvar_';

           // Gets all variation-related parameters for the prefix.
            var params = parameterMap.getParameterMap(formPrefix + this.object.ID.replace(/_/g,'__') + '_');
            var paramNames = params.getParameterNames();

            if (!paramNames.getLength() && this.object.variationModel) {
                return this.object.variationModel;
            }

            var ProductVariationModel = app.getModel('ProductVariation');
            var variationModel = new ProductVariationModel(this.object.getVariationModel());

            for (var k = 0; k < paramNames.length; k++) {
                var attributeID = paramNames[k];
                var valueID = params.get(attributeID).getStringValue();

                if (valueID) {
                    var variationAttribute = variationModel.getProductVariationAttribute(attributeID);

                    if (variationAttribute && valueID) {

                        // @TODO API does not exist
                        var variationAttributeValue = variationModel.getVariationAttributeValue(variationAttribute, valueID);
                        if (variationAttributeValue) {
                            // @TODO API does not exist
                            variationModel.setSelectedVariationValue(variationAttribute, variationAttributeValue);
                        }
                    }
                }
            }
            return variationModel;
        },
        /**
         * Processes option value selections and calculates and returns the ProductOptionModels
         * for one or multiple products.
         * Option value selections must be specified as HTTP parameters in the following form:
         * <pre>{prefix_}{pid}_optionID={optionValueID}</pre>
         *
         * A custom prefix is set using the 'optionalCustomPrefix" parameter. Otherwise,
         * the default prefix <code>dwopt_</code> is used. {pid} is the product id.
         *
         * Example: <pre>dwopt_PN00049_memory=2GB</pre>
         *
         * For each product
         * specified as {pid}, a ProductOptionModel instance is created and returned as an element of the 'ProductOptionModels'
         * HashMap output parameter. The function validates both option id and option value id and selects the option in the
         * related ProductOptionModel instance.
         *
         * If an option is not specified as an HTTP parameter, or the specified optionValueID
         * is invalid, the default option value of this option is selected. Invalid optionIDs are silently ignored. The
         * function returns a map of ProductOptionModels with the product instance as the key and the ProductOptionModel as
         * the value. For compatibility reasons, the function does still accept an individual product instance as input
         * parameter. If specified, the function returns the ProductOptionModel for this product as 'ProductOptionModel' and
         * also as element of the 'ProductOptionModels' hashmap parameter.
         *
         * @alias module:models/ProductModel~ProductModel/updateOptionSelection
         * @param product {dw.catalog.Product} An optional product instance for which the ProductOptionModel is updated.
         * @param parameterMap {dw.web.HttpParameterMap} Product option selections as HTTP parameters.
         * @param optionalCustomPrefix {String} Optional prefix for HTTP parameters. If nothing is passed, the default prefix "dwopt_" is assumed.
         *
         * @returns {dw.catalog.ProductOptionModel} The product option model.
         */
        updateOptionSelection: function (parameterMap, optionalCustomPrefix) {
            var formPrefix = optionalCustomPrefix || 'dwopt_';

            // Gets all option related parameters for the prefix.
            var params = parameterMap.getParameterMap(formPrefix + this.object.ID.replace(/_/g,'__') + '_');
            var paramNames = params.getParameterNames();

            var optionModel = this.object.getOptionModel();

            for (var k = 0; k < paramNames.length; k++) {
                var optionID      = paramNames[k];
                var optionValueID = params.get(optionID).getStringValue();

                if (optionValueID) {
                    var option = optionModel.getOption(optionID);

                    if (option && optionValueID) {
                        var optionValue = optionModel.getOptionValue(option, optionValueID);
                        if (optionValue) {
                            optionModel.setSelectedOptionValue(option, optionValue);
                        }
                    }
                }
            }

            return optionModel;
        },
        /**
         * Returns the default variant or the first variant if none is defined.
         *
         * @alias module:models/ProductModel~ProductModel/getDefaultVariant
         * @param  {boolean} onlyAvailable if set to true, only available products are returned.
         * @return {dw.catalog.Product} the default variant or the first variant if none is defined.
         */
        getDefaultVariant: function (onlyAvailable) {
            var product = this.object;
            var variationModel = product.getVariationModel();
            var firstProduct = !variationModel.variants.size() ? product :
                (product.getVariationModel().getDefaultVariant() || this.getDefaultVariant());

            onlyAvailable = typeof onlyAvailable === 'undefined' ? true : onlyAvailable;
            if (!firstProduct || !firstProduct.onlineFlag || (onlyAvailable && firstProduct.getAvailabilityModel().availability === 0)) {
                var variantsIterator = product.getVariants().iterator();
                while (variantsIterator.hasNext()) {
                    var variant = variantsIterator.next();
                    if (variant.onlineFlag && variant.getAvailabilityModel().availability > 0) {
                        firstProduct = variant;
                        break;
                    }
                }
            }
            return firstProduct;
        },

        /**
         * Returns a collection of all online products that are assigned to this product and
         * that are also available through the current site. If this product does not represent a
         * product set then an empty collection is returned.
         *
         * @alias module:models/ProductModel~ProductModel/getOnlineProductSetProducts
         * @return {dw.util.Collection} Collection of online products that are assigned to this product and that are also available through the current site.
         */
        getOnlineProductSetProducts: function () {

            var onlineProductSetProducts = new dw.util.ArrayList();

            if (this.object.isProductSet()) {
                var productSetProducts = this.object.getProductSetProducts();

                var i = null;
                for (i = 0; i < productSetProducts.length; i++) {
                    if (productSetProducts[i].isOnline()) {
                        onlineProductSetProducts.add(productSetProducts[i]);
                    }
                }
            }

            return onlineProductSetProducts;
        },

        /**
         * Returns true if the product is visible in the storefront. The function checks the online flag of the product
         * itself and if the product is a product set, checks the online flag of all products in the product set.
         *
         * @alias module:models/ProductModel~ProductModel/isVisible
         * @returns {boolean} true if the product is visible in the storefront, false otherwise
         */
        isVisible: function () {

            if (!this.object) {
                return false;
            }

            if (!this.isOnline()) {
                return false;
            }

            if (this.isProductSet() && this.getOnlineProductSetProducts().isEmpty()) {
                return false;
            }

            return true;
        },

        /**
         * Gets a selected ProductVariationAttributeValue.
         *
         * @alias module:models/ProductModel~ProductModel/getSelectedAttributeValue
         * @param {String} variationAttribute name of the attribute value to get
         * @returns {dw.catalog.ProductVariationAttributeValue}
         */
        getSelectedAttributeValue: function (variationAttribute) {
            var pvm = this.isVariant() ? this.getMasterProduct().getVariationModel() : this.getVariationModel();
            var pva = pvm.getProductVariationAttribute(variationAttribute);
            var selectedAttributeValue;

            if (pva) {
                selectedAttributeValue = pvm.getSelectedValue(pva);
                if (!selectedAttributeValue) {
                    var variant;
                    if (this.isVariant()) {
                        variant = this.object;
                    } else {
                        if (pvm.defaultVariant) {
                            variant = pvm.defaultVariant;
                        } else if (pvm.variants.length > 0) {
                            variant = pvm.variants[0];
                        }
                    }
                    if (variant) {
                        selectedAttributeValue = pvm.getVariationValue(variant, pva);
                    }
                }
            }
            return selectedAttributeValue;
        },

        /**
         * Gets the product variant for the given custom attribute name and value.
         *
         * @alias module:models/ProductModel~ProductModel/getVariantForVariationAttributeValue
         * @param {String} attrValue - The custom attribute value.
         * @param {String} attrName - The custom attribute name.
         *
         * @returns {dw.catalog.Product}
         */
        getVariantForVariationAttributeValue: function (attrValue, attrName) {
            var variants;
            var newProduct = this.object;

            if ('isVariant' in newProduct && newProduct.isVariant()) {
                variants = newProduct.getVariationModel().getVariants();
            } else {
                variants = newProduct.getVariants();
            }

            if (!variants) {
                return newProduct;
            }

            for (var i = 0, len = variants.length; i < len; i++) {
                if (variants[i].onlineFlag) {
                    newProduct = variants[i];
                    if (this.hasValue(variants[i].custom[attrName], attrValue)) {
                        break;
                    }
                }
            }

            return newProduct;
        },

        /**
         * Checks if the given String or EnumValue is equal to or has the given value.
         *
         * @alias module:models/ProductModel~ProductModel/hasValue
         * @param {Object} object - The object can be a string or a dw.value.EnumValue.
         * @param {String} value - The value to check.
         *
         * @returns {Boolean}
         */
        hasValue: function (object, value) {
            if (!value) {
                return true;
            } else if (object === value) {
                return true;
            } else if (object[0] instanceof dw.value.EnumValue) {
                // enumerate through the multiple values of the custom attribute
                for (var prop in object) {
                    if (object[prop] === value) {
                        return true;
                    }
                }
            }
            return false;
        },

        /**
         * Returns a string that represents the category paths of that category up to the root category,
         * also known as the 'breadcrumbs' in web pages
         *
         * @alias module:models/ProductModel~ProductModel/getBreadcrumbs
         * @param {dw.catalog.Category} category - The category to get the breadcrumb path for.
         * @return {String} The breadcrumb for the passed category.
         */
        getBreadcrumbs: function (category) {
            if (!category) {
                return null;
            }

            var categoryBreadcrambs = [];
            while (category.ID !== 'root') {
                categoryBreadcrambs.unshift(category.displayName);
                category = category.parent;
            }

            return categoryBreadcrambs.join(':').replace('&', '&amp;');
        },

        /**
         * Returns a JSON object holding availability information for the current product and the given
         * quantity.
         *
         * @alias module:models/ProductModel~ProductModel/getAvailability
         * @param quantity {String} the quantity. Usually, this is the amount the customer has selected to purchase.
         * @returns {{status: *, statusQuantity: number, inStock: *, ats: number, inStockDate: string, availableForSale: boolean, levels: {}}}
         */
        getAvailability: function (quantity) {
            var qty = isNaN(quantity) ? 1 : parseInt(quantity).toFixed();

            /* product availability */
            var avm = this.getAvailabilityModel();

            var availability = {
                status: avm.getAvailabilityStatus(),
                statusQuantity: qty,
                inStock: avm.inStock,
                ats: !avm.inventoryRecord ? 0 : avm.inventoryRecord.ATS.value.toFixed(),
                inStockDate: !avm.inventoryRecord || !avm.inventoryRecord.inStockDate ? '' : avm.inventoryRecord.inStockDate.toDateString(),
                availableForSale: avm.availability > 0,
                levels: {}
            };

            var avmLevels = dw.catalog.ProductAvailabilityLevels = avm.getAvailabilityLevels((qty < 1) ? 1 : qty);
            availability.isAvailable = avmLevels.notAvailable.value === 0;
            availability.inStockMsg = dw.web.Resource.msgf('global.quantityinstock', 'locale', '', avmLevels.inStock.value.toFixed());
            availability.preOrderMsg = dw.web.Resource.msgf('global.quantitypreorder', 'locale', '', avmLevels.preorder.value.toFixed());
            availability.backOrderMsg = dw.web.Resource.msgf('global.quantitybackorder', 'locale', '', avmLevels.backorder.value.toFixed());
            if (avm && avm.inventoryRecord && avm.inventoryRecord.inStockDate) {
                availability.inStockDateMsg = dw.web.Resource.msgf('global.inStockDate', 'locale', '', avm.inventoryRecord.inStockDate.toDateString());
            }

            availability.levels[dw.catalog.ProductAvailabilityModel.AVAILABILITY_STATUS_IN_STOCK] = avmLevels.inStock.value;
            availability.levels[dw.catalog.ProductAvailabilityModel.AVAILABILITY_STATUS_PREORDER] = avmLevels.preorder.value;
            availability.levels[dw.catalog.ProductAvailabilityModel.AVAILABILITY_STATUS_BACKORDER] = avmLevels.backorder.value;
            availability.levels[dw.catalog.ProductAvailabilityModel.AVAILABILITY_STATUS_NOT_AVAILABLE] = avmLevels.notAvailable.value;

            return availability;
        }

    });

/**
 * Gets a new instance of a given product or product ID.
 *
 * @alias module:models/ProductModel~ProductModel/get
 * @param parameter {(dw.catalog.Product|String)} The product object to enhance/wrap or the product ID of the product object.
 * @returns {module:models/ProductModel~ProductModel}
 */
ProductModel.get = function (parameter) {
    var obj = null;
    if (typeof parameter === 'string') {
        obj = dw.catalog.ProductMgr.getProduct(parameter);
    } else if (typeof parameter === 'object') {
        obj = parameter;
    }
    return new ProductModel(obj);
};

/** The product class */
module.exports = ProductModel;
