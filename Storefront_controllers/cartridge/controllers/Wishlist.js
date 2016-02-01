'use strict';

/**
 * This controller implements the functionality for wishlists.
 *
 * @module controllers/Wishlist
 */

/* API Includes */
var Transaction = require('dw/system/Transaction');

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');


/**
 * Forms handling for the landing page
 */
function landingForm() {
    var wishlistForm = app.getForm('wishlist');
    wishlistForm.handleAction({
        register: function () {
           response.redirect(dw.web.URLUtils.https('Account-StartRegister'));
           return;
        },
        search: function () {
            search();
            return;
        }
    });
}


/**
 * Renders the wishlist page.
 */
function show() {
    var Content = app.getModel('Content');
    var wishlistAsset = Content.get('myaccount-wishlist');

    var pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(wishlistAsset);

    var wishlistForm = app.getForm('wishlist');
    wishlistForm.clear();

    var ProductList = app.getModel('ProductList');
    var productList = ProductList.get();
    wishlistForm.get('items').copyFrom(productList.object.items);
    // init address book
    wishlistForm.get('addressbook').get('addresses').copyFrom(customer.profile.addressBook.addresses);

    app.getView({
        ProductList: productList.object,
        ContinueURL: dw.web.URLUtils.https('Wishlist-WishListForm')
    }).render('account/wishlist/wishlist');
}


/**
 * Forms handler for processing wish lists.
 */
function wishListForm() {
    var productList = app.getModel('ProductList').get();

    var wishlistForm = app.getForm('wishlist');
    wishlistForm.handleAction({
        addGiftCertificate: function () {
            new dw.system.Pipelet('AddGiftCertificateToProductList')
                .execute({
                    ProductList: productList.object,
                    Priority: 0
                });
        },
        deleteItem: function (formgroup, action) {
            dw.system.Logger.info('Deleting product {0} from wishlist.',action.object.productID);
            productList.remove(action.object);
        },
        updateItem: function (formgroup, action) {
            dw.system.Logger.info('Updating product {0} on wishlist.',action.object.productID);
            app.getForm(action.parent).copyTo(action.object);
        },
        setItemPrivate: function (formgroup, action) {
            Transaction.wrap(function () {
                  action.object.public = false;
            });
        },
        setItemPublic: function (formgroup, action) {
            Transaction.wrap(function () {
                  action.object.public = true;
            });
        },
        setListPrivate: function () {
            dw.system.Logger.info('Customer {0} set wishlist private.',customer.ID);
            productList.setPublic(false);
        },
        setListPublic: function () {
            dw.system.Logger.info('Customer {0} set wishlist public.',customer.ID);
            productList.setPublic(true);
        },
        selectAddressWishlist: function () {
            setShippingAddress();
            return;
        },
        addToCart: function (formgroup) {
            if (formgroup.items.triggeredFormAction.parent.object.type === formgroup.items.triggeredFormAction.parent.object.TYPE_GIFT_CERTIFICATE) {

                var GiftCertController = app.getController('GiftCert');
                GiftCertController.Purchase();
                return;
            } else {

                var CartController = app.getController('Cart');
                CartController.AddProduct();
                return;
            }
        }
    });

    response.redirect(dw.web.URLUtils.https('Wishlist-Show'));
}


/**
 * TODO Expects: UserID
 */
function showOther() {
    var wishlistForm = app.getForm('wishlist');
    wishlistForm.get('send').clear();

    var ProductList = app.getModel('ProductList');
    var productList = ProductList.get(request.httpParameterMap.WishListID.value);
    wishlistForm.get('items').copyFrom(productList.object.items);

    app.getView({
        ProductList: productList.object,
        ContinueURL: dw.web.URLUtils.https('Wishlist-WishListForm')
    }).render('account/wishlist/wishlist');
}

/**
 * Uses request parameters to add a product.
 */
function addProduct() {
    var Product = app.getModel('Product');
    var product = Product.get(request.httpParameterMap.pid.stringValue);
    var productOptionModel = product.updateOptionSelection(request.httpParameterMap);

    var ProductList = app.getModel('ProductList');
    var productList = ProductList.get();
    productList.addProduct(product.object, request.httpParameterMap.Quantity.doubleValue || 1, productOptionModel);
}

/**
 * Adds a product given by the HTTP parameter "pid" to the wishlist and displays
 * the updated wishlist.
 */
function add() {
    addProduct();
    response.redirect(dw.web.URLUtils.https('Wishlist-Show'));
}


/**
 * TODO
 * Expects (optional): - OwnerEmail - OwnerFirstName - OwnerLastName
 */
function search() {
    var searchForm = app.getForm('wishlist.search');

    var searchFirstName, searchLastName, searchEmail = null;

    searchFirstName = searchForm.get('firstname').value();
    searchLastName = searchForm.get('lastname').value();
    searchEmail = searchForm.get('email').value();

    if (searchForm.valid() && (!empty(searchFirstName) && !empty(searchLastName) && !empty(searchEmail))) {
        // @TODO API is different from pipelet SearchProductLists
        // var queryString = 'OwnerFirstName = ' + searchFirstName + ' AND OwnerLastName = ' +
        //     searchLastName + ' AND OwnerEmail = ' + searchEmail;
        // var productLists = dw.customer.ProductListMgr.queryProductLists(queryString, null, null);
        var productLists = new dw.system.Pipelet('SearchProductLists').execute({
            OwnerFirstName: searchFirstName,
            OwnerLastName: searchLastName,
            OwnerEmail: searchEmail,
            Type: dw.customer.ProductList.TYPE_WISH_LIST
        }).ProductLists;

        app.getForm('wishlist.productlists').copyFrom(productLists);

        searchForm.clear();
    }

    app.getView({
        SearchFirstName: searchFirstName,
        SearchLastName: searchLastName,
        SearchEmail: searchEmail
    }).render('account/wishlist/wishlistresults');
}


/**
 * Set the shipping address for the wishlist.
 * Expects AddressID to be already stored in the httpParameterMap.
 */
function setShippingAddress() {
    var address = null;
    var addressId = request.httpParameterMap.AddressID.stringValue || request.httpParameterMap.editAddress.stringValue;

    if (addressId) {
        address = dw.customer.AddressBook.getAddress(addressId);
    }

    var ProductList = app.getModel('ProductList');
    var productList = ProductList.get();
    Transaction.wrap(function () {
         productList.setShippingAddress(address);
    });
    response.redirect(dw.web.URLUtils.https('Wishlist-Show'));
}

/**
 * Replaces an item in the wishlist.
 */
function replaceProductListItem() {
    var plid = request.httpParameterMap.uuid.stringValue;

    var ProductList = app.getModel('ProductList');


    ProductList = ProductList.get();

    var productListItem = ProductList.getItem(plid);
    if (productListItem !== null) {

        Transaction.wrap(function () {
            ProductList.removeItem(productListItem);
            addProduct();
        });
    }


    app.getView().render('account/wishlist/refreshwishlist');
}

/*
 * Module exports
 */

/*
 * Web exposed methods
 */
// own wishlist
/** @see module:controllers/Wishlist~Add */
exports.Add = guard.ensure(['get', 'https', 'loggedIn'], add, {scope: 'wishlist'});
/** @see module:controllers/Wishlist~Show */
exports.Show = guard.ensure(['get', 'https', 'loggedIn'], show, {scope: 'wishlist'});
/** @see module:controllers/Wishlist~ReplaceProductListItem */
exports.ReplaceProductListItem = guard.ensure(['get', 'https', 'loggedIn'], replaceProductListItem, {scope: 'wishlist'});
/** @see module:controllers/Wishlist~SetShippingAddress */
exports.SetShippingAddress = guard.ensure(['get', 'https', 'loggedIn'], setShippingAddress, {scope: 'wishlist'});

// others wishlist
/** @see module:controllers/Wishlist~Search */
exports.Search = guard.ensure(['post', 'https'], search);
/** @see module:controllers/Wishlist~ShowOther */
exports.ShowOther = guard.ensure(['get', 'https'], showOther);

// form handlers
/** @see module:controllers/Wishlist~LandingForm */
exports.LandingForm = guard.ensure(['post', 'https'], landingForm);
/** @see module:controllers/Wishlist~WishListForm */
exports.WishListForm = guard.ensure(['post', 'https', 'loggedIn'], wishListForm, {scope: 'wishlist'});
