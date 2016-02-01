'use strict';
var g = require('~/cartridges/scripts/guard');
var ISML = require('dw/template/ISML');

/**
 * Controller that handles PowerReview Request (Product Reviews)
 *
 * @module controllers/PowerReviews
 * @todo  Remove this controller including its referenced files
 */

/**
 * Renders a product XML description based on the given ID. Uses the product ID
 * from the httpParameterMap to get product information. If no product ID exists,
 * renders an error page (error/notfound template).
 */
function XmlProductDescription() {
    var GetProductResult = new dw.system.Pipelet('GetProduct').execute({
        ProductID: request.httpParameterMap.pid.stringValue
    });
    if (GetProductResult.result === PIPELET_ERROR) {
        ISML.renderTemplate('error/notfound');
        return;
    }
    var Product = GetProductResult.Product;

    ISML.renderTemplate('product/components/powerreviews-xmlproduct', {
        Product: Product
    });
}


/**
 * Renders a form to create a product review.
 */
function WriteReview() {
    var ProductID = request.httpParameterMap.pid.stringValue;
    if (empty(ProductID)) {
        ISML.renderTemplate('error/notfound');
        return;
    }

    var GetProductResult = new dw.system.Pipelet('GetProduct').execute({
        ProductID: ProductID
    });
    if (GetProductResult.result === PIPELET_ERROR) {
        ISML.renderTemplate('error/notfound');
        return;
    }
    var Product = GetProductResult.Product;

    if (!customer.authenticated) {
        var accountController = require('./Account');
        accountController.requireLogin({
            TargetAction: 'PowerReviews-WriteReview',
            TargetParameters: ['pid', ProductID]
        });
        return;
    }

    var ScriptResult = new dw.system.Pipelet('Script', {
        Transactional: false,
        ScriptFile: 'Storefront_core:common/FindLastClickStream.ds'
    }).execute({
        lastMatchedClickUrl: Location,
        pipelineName: 'Product-Show'
    });
    var Location = ScriptResult.lastMatchedClickUrl;

    ISML.renderTemplate('product/writereview', {
        Location: Location,
        Product: Product
    });
}


/*
 * Module exports
 */

/*
 * Web exposed methods
 */
/** Renders a product XML description based on the given ID.
 * @see module:controllers/PowerReviews~XmlProductDescription */
exports.XmlProductDescription   = g.get(XmlProductDescription);
/** Renders a form to create a product review.
 * @see module:controllers/PowerReviews~WriteReview */
exports.WriteReview             = g.httpsGet(WriteReview);
