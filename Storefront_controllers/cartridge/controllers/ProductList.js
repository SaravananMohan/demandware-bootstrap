'use strict';

/**
 * Controller that initializes the product list and creates a new list if none is found.
 * It also determines a selected product list item based on the given ID.
 *
 * @module  controllers/ProductList
 * @TODO this should be a library, not a controller
 * @FIXME Isn't this already done in the ProductListModel? Not called from anywhere that I can tell.
 */

 /**
 * Initializes a product list and creates a new list if none is found.
 */
function Init(args) {
    var productListId = args.productListId;
    var listItemId = args.listItemId;

    var ProductList = null;
    var ProductListItem = null;

    var GetProductListResult = new dw.system.Pipelet('GetProductList', {
        Create: false
    }).execute({
        ProductListID: productListId
    });
    if (GetProductListResult.result === PIPELET_NEXT) {
        ProductList = GetProductListResult.ProductList;
    }

    var ProductOptionModel = null;

    if (ProductList !== null) {
        ProductListItem = ProductList.getItem(listItemId);

        var UpdateProductOptionSelectionsResult = new dw.system.Pipelet('UpdateProductOptionSelections').execute({
            Product: ProductListItem.product
        });
        ProductOptionModel = UpdateProductOptionSelectionsResult.ProductOptionModel;
    }

    return {
        ProductListItem: ProductListItem,
        ProductOptionModel: ProductOptionModel
    };
}


/**
 * Locates a shipment associated with a product list. If it cannot find one, one is created.
 *
 * __Note:__ this function is called by the
 * {@link module:controllers/GiftRegistryCustomer~PurchaseGiftCertificate|GiftRegistry controller PurchaseGiftCertificate function}.
 * @param args {object} JSON object containing a basket.
 * @param args.Basket {dw.order.Basket} A basket associated with the product list.
 */
function EnsureShipment(args) {
    var ProductList = args.ProductList;
    var ProductListItem = args.ProductListItem;
    var Basket = args.Basket;
    var Shipment;

    var ShipmentID = ProductListItem.list.name;

    if (empty(ShipmentID) || ProductListItem.list.shippingAddress === null) {
        var GenerateShipmentNameResult = new GenerateShipmentName({
            ProductList: ProductList
        });

        ShipmentID = GenerateShipmentNameResult.ShipmentID;
    }


    if (Basket.getShipment(ShipmentID) !== null) {
        Shipment = Basket.getShipment(ShipmentID);
    } else {
        var CreateShipmentResult = new dw.system.Pipelet('CreateShipment').execute({
            Basket: Basket,
            ID: ShipmentID
        });
        Shipment = CreateShipmentResult.Shipment;
    }


}


/**
 * Generates a shipment ID based on the type of product list passed in. Also assigns this name to the product list itself.
 * Note that if the product list does not have a shipping address, the default shipping address name is used. Calls the
 * GenerateShipmentName.ds script.
 */
function GenerateShipmentName(args) {
    var ProductList = args.ProductList;
    var ShipmentID;
    var Basket;

    if (ProductList.shippingAddress !== null) {
        var ScriptResult = new dw.system.Pipelet('Script', {
            Transactional: true,
            OnError: 'PIPELET_ERROR',
            ScriptFile: 'Storefront_core:productlist/GenerateShipmentName.ds'
        }).execute({
            ProductList: ProductList
        });
        if (ScriptResult.result === PIPELET_NEXT) {
            ShipmentID = ScriptResult.ShipmentID;

            return {
                ShipmentID: ShipmentID
            };
        }
    }

    ShipmentID = Basket.defaultShipment.ID;

    return {
        ShipmentID: ShipmentID
    };
}


/*
 * Module exports
 */

/*
 * Local methods
 */
/** Renders a list of bonus products for a bonus discount line item.
 * @see module:controllers/ProductList~Init */
exports.Init                    = Init;
/** Ensure shipment locates a shipment associated with a product list.
 * @see module:controllers/ProductList~EnsureShipment */
exports.EnsureShipment          = EnsureShipment;
/** Generates a shipment ID based on the type of product list passed in.
 * @see module:controllers/ProductList~GenerateShipmentName */
exports.GenerateShipmentName    = GenerateShipmentName;
