'use strict';

/**
 * Controller for gift registry business logic.
 *
 * @module  controllers/GiftRegistry
 */

/* API Includes */
var Pipelet = require('dw/system/Pipelet');
var ProductList = require('dw/customer/ProductList');
var Transaction = require('dw/system/Transaction');

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');

var Content = app.getModel('Content');
var ProductList = app.getModel('ProductList');
var Form = app.getModel('Form');


//var giftRegistryForm = Form.get('giftregistry');

/**
 * Controls the login that is required to access gift registry actions.
 * @FIXME Doesn't appear to actually be called by anything.
 */
function submitFormLanding() {
    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'search') {
            search();
            return;
        }
    }

}


/**
 * Renders a list of gift registries associated with the current customer.
 * Clears the productlists form and gets the product lists associated with a customer. Gets the
 * myaccount-giftregistry content asset, updates the page metadata and renders the registry list
 * page (account/giftregistry/registrylist template).
 */
function start() {
    var productListsForm = session.forms.productlists;

    Form.get(productListsForm).clear();


    var GetProductListsResult = new Pipelet('GetProductLists').execute({
        Customer: customer,
        Type: ProductList.TYPE_GIFT_REGISTRY
    });
    var ProductLists = GetProductListsResult.ProductLists;

    Form.get(productListsForm.items).copyFrom(ProductLists);

    var accountGiftRegistry = Content.get('myaccount-giftregistry');

    var pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(accountGiftRegistry);

    app.getView().render('account/giftregistry/registrylist');
}

/**
 * Creates or searches for a gift registry. Renders the registry list
 * page (account/giftregistry/registrylist template).
 */
function registrymain() {

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'create') {
            create();
            return;
        } else if (TriggeredAction.formId === 'search') {
            var productListsForm = session.forms.productlists;

            if (productListsForm.search.eventMonth.value !== null && productListsForm.search.eventYear.value === null) {
                productListsForm.search.eventYear.invalidateFormElement();

                app.getView().render('account/giftregistry/registrylist');
                return;
            }

            search();
            return;
        }
    }

    app.getView().render('account/giftregistry/registrylist');
}


/**
 * Adds a product to the gift registry. The product must either be a Product object, or is identified by its
 * product ID using the dictionary key ProductID or, if empty, uses the HTTP parameter "pid".
 */
function addProduct() {
    var currentHttpParameterMap = request.httpParameterMap;



    var Product = null;

    if (Product === null) {
        if (currentHttpParameterMap.pid.stringValue !== null) {
            var ProductID = currentHttpParameterMap.pid.stringValue;

            var GetProductResult = new Pipelet('GetProduct').execute({
                ProductID: ProductID
            });
            if (GetProductResult.result === PIPELET_ERROR) {
                return {
                    error: true
                };
            }
            Product = GetProductResult.Product;
        }
    }


    var GetProductListsResult = new Pipelet('GetProductLists').execute({
        Customer: customer,
        Type: ProductList.TYPE_GIFT_REGISTRY
    });
    var ProductLists = GetProductListsResult.ProductLists;

    //var ProductList = null;

    if (typeof(ProductLists) !== 'undefined' && ProductLists !== null && !ProductLists.isEmpty()) {
        if (ProductLists.size() === 1) {
            ProductList = ProductLists.iterator().next();
        } else {
            selectOne();
            return;
        }
    } else {
        createOne();
        return;
    }


    //var UpdateProductOptionSelectionsResult = new Pipelet('UpdateProductOptionSelections').execute({
    //    Product: Product
    //});


    //var ProductOptionModel = UpdateProductOptionSelectionsResult.ProductOptionModel;


    // var AddProductToProductListResult = new Pipelet('AddProductToProductList', {
    //     DisallowRepeats: true
    // }).execute({
    //     Product: Product,
    //     ProductList: ProductList,
    //     Quantity: currentHttpParameterMap.Quantity.getIntValue(),
    //     ProductOptionModel: ProductOptionModel,
    //     Priority: 2
    // });


    showRegistry({
        ProductList: ProductList
    });
    return;
}


/**
 * Provides the actual creation logic for the gift registry in three steps: event participants, participant addresses
 * and a final confirmation. Renders the event participant page (account/giftregistry/eventparticipant template).
 */
function createOne() {
    var participantForm = session.forms.giftregistry.event.participant;

    Form.get(session.forms.giftregistry).clear();

    participantForm.firstName.value = customer.profile.firstName;
    participantForm.lastName.value = customer.profile.lastName;
    participantForm.email.value = customer.profile.email;

    app.getView().render('account/giftregistry/eventparticipant');
}

/**
 * Event handler for gift registry addresses.
 * Checks the last triggered action and handles them depending on the formId associated with the triggered action.
 * If the formId is:
 * - __back__ - calls the {@link module:controllers/GiftRegistry~start|start} function
 * - __confirm__ - if there are no addresses in the customer address book, sets a flag to indicate the
 * before event shipping address is new. Calls the {@link module:controllers/GiftRegistry~showAddresses|showAddresses} function.
 * @FIXME Doesn't appear to ever be called.
 */
function eventParticipant() {
    var currentForms = session.forms;

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'back') {
            start();
            return;
        } else if (TriggeredAction.formId === 'confirm') {
            if (customer.profile.addressBook.addresses.size() === 0) {
                currentForms.giftregistry.eventaddress.beforeEventAddress.value = 'newaddress';
            }

            showAddresses();
        }
    }
}

/**
 * Renders the gift registry addresses page (account/giftregistry/addresses template).
 */
function showAddresses() {
    app.getView().render('account/giftregistry/addresses');
}

/**
 * TODO
 */

// function participantAddresses() {
//     var currentForms = session.forms;
//     var AddressFormType;
//
//     var TriggeredAction = request.triggeredFormAction;
//     if (TriggeredAction !== null) {
//         if (TriggeredAction.formId === 'back') {
//             new Pipelet('Script', {
//                 Transactional: false,
//                 OnError: 'PIPELET_ERROR',
//                 ScriptFile: 'account/giftregistry/CopyAddressFormFields.ds'
//             }).execute({
//                 GiftRegistryForm: currentForms.giftregistry
//             });

//             app.getView().render('account/giftregistry/eventparticipant');
//             return;
//         } else if (TriggeredAction.formId === 'confirm') {
//             if (currentForms.giftregistry.copyAddress.checked) {
//                 new Pipelet('Script', {
//                     Transactional: false,
//                     OnError: 'PIPELET_ERROR',
//                     ScriptFile: 'account/giftregistry/AssignPostEventShippingAddress.ds'
//                 }).execute({
//                     GiftRegistryForm: currentForms.giftregistry
//                 });
//             }

//             showConfirmation();
//             return;
//         } else if (TriggeredAction.formId === 'selectAddressAfter') {
//             AddressFormType = 'after';

//             updateAddressDetails();
//             return;
//         } else if (TriggeredAction.formId === 'selectAddressBefore') {
//             AddressFormType = 'before';

//             updateAddressDetails();
//             return;
//         }
//     }

//     if (!currentForms.giftregistry.eventaddress.valid) {
//         showAddresses();
//         return;
//     }

//     if (currentForms.giftregistry.eventaddress.beforeEventAddress.value === 'newaddress' && !currentForms.giftregistry.eventaddress.addressBeforeEvent.valid) {
//         showAddresses();
//         return;
//     }

//     if (currentForms.giftregistry.eventaddress.afterEventAddress.value === 'newaddress' && !currentForms.giftregistry.eventaddress.addressAfterEvent.valid) {
//         showAddresses();
//         return;
//     }

//     showConfirmation();
// }

/**
 * Renders the gift registry confirmation page (account/giftregistry/giftregistryconfirmation template).
 */
function showConfirmation() {
    app.getView().render('account/giftregistry/giftregistryconfirmation');
}

/**
 * Gift registry event handler. Handles the last triggered action based in the formId.
 *
 * If the formId is:
 *  - __back__ -  calls the {@link module:controllers/GiftRegistry~showAddresses|showAddresses} function.
 *  - __confirm__ - gets the product list associated with the customer and calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 *  If neither of these actions was the last triggered action, then the function checks if the before-or after-event shipping address is a new address
 *  and if it is already in the customer address book, calls showAddresses. The function creates the product list and the registrants.
 *  It also calls a script (account/giftregistry/AssignEventAddresses.ds) to assign the event addresses and then calls {@link module:controllers/GiftRegistry~showConfirmation|showConfirmation}.
 *  @transaction
*/
function confirmation() {
    var currentForms = session.forms;
    var CreateProductListRegistrantResult;
    var ProductListRegistrant;
    var Address;
    var GetCustomerAddressResult;
    var ProductList;

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'back') {
            showAddresses();
            return;
        } else if (TriggeredAction.formId === 'confirm') {
            /*
             * If the product list isn't null then confirm has been called via the browser back button
             */
            if (currentForms.giftregistry.object !== null) {
                var GetProductListResult = new Pipelet('GetProductList', {
                    Create: false
                }).execute({
                    ProductListID: currentForms.giftregistry.object.UUID
                });
                if (GetProductListResult.result === PIPELET_NEXT) {
                    ProductList = GetProductListResult.ProductList;

                    showRegistry({
                        ProductList: ProductList
                    });
                    return;
                }
            }

            if (currentForms.giftregistry.eventaddress.beforeEventAddress.value === 'newaddress') {
                GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
                    AddressID: currentForms.giftregistry.eventaddress.addressBeforeEvent.addressid.value,
                    Customer: customer
                });
                if (GetCustomerAddressResult.result === PIPELET_NEXT) {
                    Address = GetCustomerAddressResult.Address;

                    currentForms.giftregistry.eventaddress.addressBeforeEvent.addressid.invalidateFormElement();

                    showAddresses();
                    return;
                }
            }


            if (currentForms.giftregistry.eventaddress.afterEventAddress.value === 'newaddress') {
                GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
                    AddressID: currentForms.giftregistry.eventaddress.addressAfterEvent.addressid.value,
                    Customer: customer
                });
                if (GetCustomerAddressResult.result === PIPELET_NEXT) {
                    Address = GetCustomerAddressResult.Address;

                    currentForms.giftregistry.eventaddress.addressAfterEvent.addressid.invalidateFormElement();

                    showAddresses();
                    return;
                }
            }

            var CreateProductListResult = new Pipelet('CreateProductList').execute({
                Type: ProductList.TYPE_GIFT_REGISTRY,
                Customer: customer
            });
            var CreatedProductList = CreateProductListResult.ProductList;

            Transaction.wrap(function () {
                CreatedProductList.eventState = currentForms.giftregistry.event.eventaddress.states.state.value;
                CreatedProductList.eventCountry = currentForms.giftregistry.event.eventaddress.country.value;
             }
                );



            if (!Form.get(currentForms.giftregistry.event).copyTo(CreatedProductList)) {
                return {
                    error: true
                };
            }


            CreateProductListRegistrantResult = new Pipelet('CreateProductListRegistrant', {
                CreateCoRegistrant: false
            }).execute({
                ProductList: CreatedProductList
            });
            if (CreateProductListRegistrantResult.result === PIPELET_ERROR) {
                return {
                    error: true
                };
            }
            ProductListRegistrant = CreateProductListRegistrantResult.ProductListRegistrant;

            if (!Form.get(currentForms.giftregistry.event.participant).copyTo(ProductListRegistrant)) {
                return {
                    error: true
                };
            }

            if (!(currentForms.giftregistry.event.coParticipant.role.selectedOption === null || currentForms.giftregistry.event.coParticipant.role.selectedOption.htmlValue === '')) {
                CreateProductListRegistrantResult = new Pipelet('CreateProductListRegistrant', {
                    CreateCoRegistrant: true
                }).execute({
                    ProductList: CreatedProductList
                });
                if (CreateProductListRegistrantResult.result === PIPELET_ERROR) {
                    return {
                        error: true
                    };
                }
                ProductListRegistrant = CreateProductListRegistrantResult.ProductListRegistrant;

                if (!Form.get(currentForms.giftregistry.event.coParticipant).copyTo(ProductListRegistrant)) {
                    return {
                        error: true
                    };
                }
            }


            var ScriptResult = new Pipelet('Script', {
                ScriptFile: 'account/giftregistry/AssignEventAddresses.ds',
                Transactional: true
            }).execute({
                ProductList: CreatedProductList,
                GiftRegistryForm: currentForms.giftregistry,
                Customer: customer
            });
            if (ScriptResult.result === PIPELET_ERROR) {
                return {
                    error: true
                };
            }


            return;
        }
    }

    showConfirmation();
}


/**
 * Selects a gift registry from a list of gift registries that are found by the registry search.
 * Called by {@link module:controllers/GiftRegistry~addProduct}.
 */
function selectOne() {
    var currentForms = session.forms;


    var ProductLists;


    Form.get(currentForms.productlists.items).copyFrom(ProductLists);

    app.getView().render('account/giftregistry/registryselect');
}


/**
 * Provides actions to edit a gift registry event.
 */
function selectProductListInteraction() {

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'select') {


            //var ProductList = TriggeredAction.object;

            // where to continue now?
            return;
        }
    }


}

/**
 * Clears the giftregistry form and prepopulates event and participant information from the current ProductListModel.
 * Calls the {@link module:controllers/GiftRegistry~showEditParticipantForm|showEditParticipantForm} function.
 */
function editEvent() {
    var currentForms = session.forms;


    Form.get(currentForms.giftregistry).clear();
    Form.get(currentForms.giftregistry.event).copyFrom(ProductList, true);
    Form.get(currentForms.giftregistry.event.participant).copyFrom(ProductList.registrant);

    if (ProductList.coRegistrant !== null) {
        Form.get(currentForms.giftregistry.event.coParticipant).copyFrom(ProductList.coRegistrant);
    }


    currentForms.giftregistry.event.eventaddress.states.state.value = ProductList.eventState;
    currentForms.giftregistry.event.eventaddress.country.value = ProductList.eventCountry;


    showEditParticipantForm();
}

/**
 * Renders the event participant page (account/giftregistry/eventparticipant template).
 */
function showEditParticipantForm() {
    app.getView().render('account/giftregistry/eventparticipant');
}
/**
 * TODO
 */


// function editEventParticipant() {
//     var currentForms = session.forms;
//     var TriggeredAction = request.triggeredFormAction;
//     if (TriggeredAction !== null) {
//         if (TriggeredAction.formId === 'back') {
//
//             showRegistry({
//                 ProductList: ProductList
//             });
//             return;
//         } else if (TriggeredAction.formId === 'confirm') {
//             if (!Form.get(currentForms.giftregistry.event).copyTo(ProductList)) {
//                 return {
//                     error: true
//                 };
//             }


//             if (!Form.get(currentForms.giftregistry.event.participant).copyTo(ProductList.registrant)) {
//                 return {
//                     error: true
//                 };
//             }

//             Transaction.wrap(function () {
//                       ProductList.eventState = currentForms.giftregistry.event.eventaddress.states.state.value;
//                       ProductList.eventCountry = currentForms.giftregistry.event.eventaddress.country.value;
//                     }
//                 );

//             if (ProductList.coRegistrant !== null) {
//                 if (!Form.get(currentForms.giftregistry.event.coParticipant).copyTo(ProductList.coRegistrant)) {
//                     return {
//                         error: true
//                     };
//                 }
//             } else {
//                 if (!(currentForms.giftregistry.event.coParticipant.role.selectedOption === null || currentForms.giftregistry.event.coParticipant.role.selectedOption.htmlValue === '')) {
//                     var CreateProductListRegistrantResult = new Pipelet('CreateProductListRegistrant', {
//                         CreateCoRegistrant: true
//                     }).execute({
//                         ProductList: ProductList
//                     });
//                     if (CreateProductListRegistrantResult.result === PIPELET_ERROR) {
//                         return {
//                             error: true
//                         };
//                     }

//
//                     //var ProductListRegistrant = CreateProductListRegistrantResult.ProductListRegistrant;


//                     if (!Form.get(currentForms.giftregistry.event.coParticipant).copyTo(ProductList.coRegistrant)) {
//                         return {
//                             error: true
//                         };
//                     }
//                 }
//             }

//             showRegistry({
//                 ProductList: ProductList
//             });
//             return;
//         } else if (TriggeredAction.formId === 'navPurchases') {
//             showPurchases();
//             return;
//         } else if (TriggeredAction.formId === 'navRegistry') {
//             showRegistry({
//                 ProductList: ProductList
//             });
//             return;
//         } else if (TriggeredAction.formId === 'navShipping') {
//             editAddresses();
//             return;
//         }
//     }

//     showEditParticipantForm();
// }

/**
 * Clears the giftregistry.purchases form and calls the {@link module:controllers/GiftRegistry~showPurchases|showPurchases} function.
 * @FIXME Should line 610 "copyForm" be "copyFrom"? And why is there another showPurchases function?
 */
function showPurchases() {
    var currentForms = session.forms;


    Form.get(currentForms.giftregistry.purchases).clear();
    Form.get(currentForms.giftregistry.purchases).copyForm(ProductList.purchases);


    showPurchases();
}

/**
 * Renders the gift registry purchases page.
 * @FIXME Why are there two identically named functions?
 */
function showPurchases() {
    app.getView().render('account/giftregistry/purchases');
}

/**
 * Event handler for gift registry navigation.
 * Checks the last triggered action and handles them depending on the formId associated
 * with the triggered action. If the formId is:
 * - __navEvent__ - calls the {@link module:controllers/GiftRegistry~editEvent|editEvent} function.
 * - __navRegistry__ - calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * - __navShipping __ - - {@link module:controllers/GiftRegistry~editAddresses|editAddresses} function.
 * If the last triggered action is none of these or null, the function calls the {@link module:controllers/GiftRegistry~showPurchases|showPurchases} function.
 */
// @secure
function showPurchasesInteraction() {

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'navEvent') {
            editEvent();
            return;
        } else if (TriggeredAction.formId === 'navRegistry') {
            showRegistry({
                ProductList: ProductList
            });
            return;
        } else if (TriggeredAction.formId === 'navShipping') {
            editAddresses();
            return;
        }
    }

    showPurchases();
}


/**
 * Renders a gift registry details page (account/giftregistry/registry template) and provides basic actions such as item updates and publishing.
 * @param {object} args - object containing a ProductList object.
 */
function showRegistry(args) {
    var giftregistryForm = session.forms.giftregistry;

    var ProductList = args.ProductList;

    Form.get(giftregistryForm).copyFrom(ProductList);
    Form.get(giftregistryForm.event).copyFrom(ProductList);


    app.getView().render('account/giftregistry/registry', {
        Status: null,
        ProductList: ProductList
    });
}

/**
 * Event handler for gift registry interactions.
 * Checks the last triggered action and handles them depending on the formId associated with the triggered action.
 * If the formId is:
 * - __addGiftCertificate__ - adds a gift certificate to the product list and alls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * - __addToCart__ - calls the {@link module:controllers/GiftCert~purchase|purchase} function.
 * - __deleteItem __ - changes the purchased quantity to zero. If this fails , it renders the registry page (account/giftregistry/registry template) with a status message.
 * - __navEvent__ - calls the {@link module:controllers/GiftRegistry~editEvent|editEvent} function
 * - __navPurchases__ - calls the {@link module:controllers/GiftRegistry~showPurchases|showPurchases} function.
 * - __navShipping __ - calls the {@link module:controllers/GiftRegistry~editAddresses|editAddresses} function.
 * - __purchaseGiftCertificate __ - calls the {@link module:controllers/GiftRegistryCustomer~PurchaseGiftCertificate|GiftRegistryCustomer controller PurchaseGiftCertificate function}.
 * - __setPrivate__ - sets the current product list as private and calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * - __setPublic __ - sets the current product list as public and calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * - __updateItem__ -  calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * If the last triggered action is none of these or null, the function renders the registry page (account/giftregistry/registry template).
 */
function showRegistryInteraction() {
    var currentForms = session.forms;
    var ProductListItem;

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'addGiftCertificate') {
            var AddGiftCertificateToProductListResult = new Pipelet('AddGiftCertificateToProductList').execute({
                ProductList: ProductList,
                Priority: 2
            });
            ProductListItem = AddGiftCertificateToProductListResult.ProductListItem;

            showRegistry({
                ProductList: ProductList
            });
            return;
        } else if (TriggeredAction.formId === 'addToCart') {
            if (currentForms.giftregistry.items.triggeredFormAction.parent.object.type === currentForms.giftregistry.items.triggeredFormAction.parent.object.TYPE_GIFT_CERTIFICATE) {
                var GiftCertController = require('./GiftCert');
                GiftCertController.Purchase();
                return;
            } else {
                var CartController = require('./Cart');
                CartController.AddProduct();
                return;
            }
        } else if (TriggeredAction.formId === 'deleteItem') {
            if (TriggeredAction.object.purchasedQuantity.value === 0) {


                //var RemoveProductListItemResult = new Pipelet('RemoveProductListItem').execute({
                //    ProductListItem: TriggeredAction.object
                //});
            } else {
                var Status = new dw.system.Status(dw.system.Status.ERROR, 'delete.restriction');

                app.getView().render('account/giftregistry/registry', {
                    Status: Status
                });
                return;
            }
        } else if (TriggeredAction.formId === 'navEvent') {
            editEvent();
            return;
        } else if (TriggeredAction.formId === 'navPurchases') {
            showPurchases();
            return;
        } else if (TriggeredAction.formId === 'navShipping') {
            editAddresses();
            return;
        } else if (TriggeredAction.formId === 'purchaseGiftCertificate') {
            ProductListItem = TriggeredAction.object;

            var GiftRegistryCustomerController = require('./GiftRegistryCustomer');
            GiftRegistryCustomerController.PurchaseGiftCertificate();
            return;
        } else if (TriggeredAction.formId === 'setPrivate') {
            Transaction.wrap(function () {
                         ProductList.public = false;
                    }
                );

            showRegistry({
                ProductList: ProductList
            });
            return;
        } else if (TriggeredAction.formId === 'setPublic') {
            Transaction.wrap(function () {
                         ProductList.public = true;
                    }
                );

            showRegistry({
                ProductList: ProductList
            });
            return;
        } else if (TriggeredAction.formId === 'updateItem') {


            //var updateAllResult = updateAll();

            showRegistry({
                ProductList: ProductList
            });
            return;
        }
    }


    app.getView().render('account/giftregistry/registry', {

    });
}


/**
 * Searches a gift registry by various parameters.
 */
function search() {
    var currentForms = session.forms;


    var SearchProductListsResult = new Pipelet('SearchProductLists', {
        PublicOnly: true
    }).execute({
        EventType: currentForms.giftregistry.search.simple.eventType.value,
        EventCity: currentForms.giftregistry.search.advanced.eventCity.value,
        EventState: currentForms.giftregistry.search.advanced.eventAddress.states.state.value,
        EventCountry: currentForms.giftregistry.search.advanced.eventAddress.country.value,
        RegistrantFirstName: currentForms.giftregistry.search.simple.registrantFirstName.value,
        RegistrantLastName: currentForms.giftregistry.search.simple.registrantLastName.value,
        Type: ProductList.TYPE_GIFT_REGISTRY,
        EventMonth: currentForms.giftregistry.search.advanced.eventMonth.value,
        EventYear: currentForms.giftregistry.search.advanced.eventYear.value,
        EventName: currentForms.giftregistry.search.advanced.eventName.value
    });
    var ProductLists = SearchProductListsResult.ProductLists;
/**
 * TODO
 */
    showSearch({
        ProductLists: ProductLists
    });
}

/**
 * Renders the gift registry results page account/giftregistry/giftregistryresults).
 * @param {object} args - JSON object with ProductLists member and ProductLists value.
 * @FIXME only called by the search() function - no need for separate function.
 */
function showSearch(args) {
    app.getView().render('account/giftregistry/giftregistryresults', {
        ProductLists: args.ProductLists
    });
}

/**
 * Event handler for gift registry search.
 * Checks the last triggered action and handles it ifthe formId associated with the triggered action is 'search'.
 * calls the {@link module:controllers/GiftRegistry~search|search} function.
 */
function searchGiftRegistry() {

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'search') {
            search();
            return;
        }
    }

    showSearch();
}


/**
 * Looks up a gift registry by its public UUID. If the customer is authenticated, it calls
 * the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function. If the customer
 * is not authenticated, it calls calls the {@link module:controllers/Account~show|Account
 * controller show function}.
 */
function showRegistryByID() {
    var currentHttpParameterMap = request.httpParameterMap;

    if (!customer.authenticated) {

        //var RequireLoginResult = RequireLogin();
        return;
    }


    var GetProductListResult = new Pipelet('GetProductList', {
        Create: false
    }).execute({
        ProductListID: currentHttpParameterMap.ProductListID.value
    });

    if (GetProductListResult.result === PIPELET_ERROR) {
        start();
        return;
    }
    var ProductList = GetProductListResult.ProductList;


    if (ProductList.owner.profile.customerNo === customer.profile.customerNo) {
        showRegistry({
            ProductList: ProductList
        });
        return;
    }


    var AccountController = require('./Account');
    AccountController.Show();
}


/**
 * TODO
 */

// function updateAddressDetails() {
//     var currentHttpParameterMap = request.httpParameterMap;
//     var currentForms = session.forms;
//     var Address;
//     var GetCustomerAddressResult;
//
//     var AddressFormType;

//     if (AddressFormType === 'before') {
//         GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
//             AddressID: empty(currentHttpParameterMap.addressID.value) ? currentHttpParameterMap.dwfrm_giftregistry_eventaddress_addressBeforeList.value : currentHttpParameterMap.addressID.value,
//             Customer: customer
//         });
//         Address = GetCustomerAddressResult.Address;


//         Form.get(currentForms.giftregistry.eventaddress.addressBeforeEvent).copyFrom(Address);
//         Form.get(currentForms.giftregistry.eventaddress.addressBeforeEvent.states).copyForm(Address);
//     } else {
//         GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
//             AddressID: empty(currentHttpParameterMap.addressID.value) ? currentHttpParameterMap.dwfrm_giftregistry_eventaddress_addressAfterList.value : currentHttpParameterMap.addressID.value,
//             Customer: customer
//         });
//         Address = GetCustomerAddressResult.Address;


//         Form.get(currentForms.giftregistry.eventaddress.addressAfterEvent).copyFrom(Address);
//         Form(currentForms.giftregistry.eventaddress.addressAfterEvent.states).copyForm(Address);
//     }


//     showAddresses();
// }


/**
 * Attempts to replace a product in the gift registry.
 * @return {Object} JSON object indicating the error state if any pipelets called throw a PIPELET_ERROR.
 */
function replaceProductListItem() {
    var currentHttpParameterMap = request.httpParameterMap;


    var GetProductListResult = new Pipelet('GetProductList', {
        Create: false
    }).execute({
        ProductListID: currentHttpParameterMap.productlistid.stringValue
    });
    if (GetProductListResult.result === PIPELET_ERROR) {
        return {
            error: true
        };
    }
    var ProductList = GetProductListResult.ProductList;


    var ScriptResult = new Pipelet('Script', {
        Transactional: true,
        OnError: 'PIPELET_ERROR',
        ScriptFile: 'Storefront_core:account/ReplaceProductListItem.ds'
    }).execute({
        ProductList: ProductList,
        plid: currentHttpParameterMap.uuid.stringValue
    });
    if (ScriptResult.result === PIPELET_ERROR) {
        app.getView().render('account/giftregistry/refreshgiftregistry', {
        });
        return;
    }


    var GetProductResult = new Pipelet('GetProduct').execute({
        ProductID: currentHttpParameterMap.pid.stringValue
    });
    if (GetProductResult.result === PIPELET_ERROR) {
        return {
            error: true
        };
    }


    //var Product = GetProductResult.Product;


    //var UpdateProductOptionSelectionsResult = new Pipelet('UpdateProductOptionSelections').execute({
    //    Product: Product
    //});
    //var ProductOptionModel = UpdateProductOptionSelectionsResult.ProductOptionModel;


    // var AddProductToProductListResult = new Pipelet('AddProductToProductList', {
    //     DisallowRepeats: true
    // }).execute({
    //     Product: Product,
    //     ProductList: ProductList,
    //     Quantity: currentHttpParameterMap.Quantity.doubleValue,
    //     ProductOptionModel: ProductOptionModel,
    //     Priority: 2
    // });


    app.getView().render('account/giftregistry/refreshgiftregistry', {});
}


/**
 * Provides gift registry actions such as address changes.
 * Clears the giftregistry form. If there is a shipping address for the current product list, copies that to the
 * before-the-event shipping address  in the form. If there is an after-the-event shipping address set for the current product list,
 * copies that to the gift registry form.
 * Calls the {@link module:controllers/GiftRegistry~showAddresses|showAddresses} function.
 * @FIXME Why are there two functions with the same name?
 */
function editAddresses() {
    var currentForms = session.forms;


    Form.get(currentForms.giftregistry).clear();


    if (ProductList.shippingAddress !== null) {
        Form.get(currentForms.giftregistry.eventaddress.addressBeforeEvent).copyFrom(ProductList.shippingAddress);
        Form.get(currentForms.giftregistry.eventaddress.addressBeforeEvent.states).copyFrom(ProductList.shippingAddress);
    }


    if (ProductList.postEventShippingAddress !== null) {
        Form.get(currentForms.giftregistry.eventaddress.addressAfterEvent).copyFrom(ProductList.postEventShippingAddress);
        Form.get(currentForms.giftregistry.eventaddress.addressAfterEvent.states).copyFrom(ProductList.postEventShippingAddress);
    }

    showAddresses();
}

/**
 * Renders the gift registry address page (account/giftregistry/addresses template).
 */
function showAddresses() {
    app.getView().render('account/giftregistry/addresses');
}

/**
 * Event handler for gift registry addresses.
 * Checks the last triggered action and handles them depending on the formId associated with the triggered action.
 * If the formId is:
 * - __back__ -  calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * - __confirm__ - calls {@link module:controllers/GiftRegistry~confirm|confirm} function.
 * - __navEvent__ - calls the {@link module:controllers/GiftRegistry~editEvent|editEvent} function
 * - __navPurchases__ - calls the {@link module:controllers/GiftRegistry~showPurchases|showPurchases} function.
 * - __navRegistry__ - calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 * If none of these are the formId of the last triggered action, then if the event addresses are not valid or are new
 * the {@link module:controllers/GiftRegistry~showAddresses|showAddresses} function is called.
 * Otherwise, the {@link module:controllers/GiftRegistry~confirm|confirm} function is called.
 *
 * @FIXME Why are there two functions with the same name?
 */
// @secure
function editAddresses() {
    var currentForms = session.forms;

    var TriggeredAction = request.triggeredFormAction;
    if (TriggeredAction !== null) {
        if (TriggeredAction.formId === 'back') {
            showRegistry({
                ProductList: ProductList
            });
            return;
        } else if (TriggeredAction.formId === 'confirm') {
            confirm();
            return;
        } else if (TriggeredAction.formId === 'navEvent') {
            editEvent();
            return;
        } else if (TriggeredAction.formId === 'navPurchases') {
            showPurchases();
            return;
        } else if (TriggeredAction.formId === 'navRegistry') {
            showRegistry({
                ProductList: ProductList
            });
            return;
        }
    }

    if (!currentForms.giftregistry.eventaddress.valid) {
        showAddresses();
        return;
    }

    if (currentForms.giftregistry.eventaddress.beforeEventAddress.value === 'newaddress' && !currentForms.giftregistry.eventaddress.addressBeforeEvent.valid) {
        showAddresses();
        return;
    }

    if (currentForms.giftregistry.eventaddress.afterEventAddress.value === 'newaddress' && !currentForms.giftregistry.eventaddress.addressAfterEvent.valid) {
        showAddresses();
        return;
    }

    confirm();
}

/**
 * Handles the confirm action for the giftregistry form. Checks to makes sure the before and after
 * event addresses do not already exist in the customer profile. If the addresses are duplicates,
 * calls the {@link module:controllers/GiftRegistry~showAddresses|showAddresses} function.
 * If they are not duplicates, calls the AssignEventAddresses.ds script to assign the event addresses
 * to the product list and then calls the {@link module:controllers/GiftRegistry~showRegistry|showRegistry} function.
 *
 * @transaction
 * @returns {Object} JSON object indicating an error occurred in the AssignEventAddresses.ds script.
 */
function confirm() {
    var currentForms = session.forms;
    var GetCustomerAddressResult;

    if (currentForms.giftregistry.eventaddress.beforeEventAddress.value === 'newaddress') {
        GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
            AddressID: currentForms.giftregistry.eventaddress.addressBeforeEvent.addressid.value,
            Customer: customer
        });
        if (GetCustomerAddressResult.result === PIPELET_NEXT) {
            currentForms.giftregistry.eventaddress.addressBeforeEvent.addressid.invalidateFormElement();

            showAddresses();
            return;
        }

    }


    if (currentForms.giftregistry.eventaddress.afterEventAddress.value === 'newaddress') {
        GetCustomerAddressResult = new Pipelet('GetCustomerAddress').execute({
            AddressID: currentForms.giftregistry.eventaddress.addressAfterEvent.addressid.value,
            Customer: customer
        });
        if (GetCustomerAddressResult.result === PIPELET_NEXT) {

            currentForms.giftregistry.eventaddress.addressAfterEvent.addressid.invalidateFormElement();

            showAddresses();
            return;
        }
    }

    var productList = ProductList.get();

    var ScriptResult = new Pipelet('Script', {
        ScriptFile: 'Storefront_core:account/giftregistry/AssignEventAddresses.ds',
        Transactional: true
    }).execute({
        ProductList: productList.object,
        Customer: customer,
        GiftRegistryForm: currentForms.giftregistry
    });
    if (ScriptResult.result === PIPELET_ERROR) {
        return {
            error: true
        };
    }

    showRegistry({
        ProductList: productList
    });
}


/**
 * Deletes a gift registry. Only the logged-in owner of the gift registry can delete it.
 * @FIXME This should be delete() since it's exported as Delete.
 */
// @secure
function Delete() {
    var currentHttpParameterMap = request.httpParameterMap;


    var GetProductListResult = new Pipelet('GetProductList', {
        Create: false
    }).execute({
        ProductListID: currentHttpParameterMap.ProductListID.value
    });
    if (GetProductListResult.result === PIPELET_NEXT) {
        var ProductList = GetProductListResult.ProductList;

        if (customer.ID === ProductList.owner.ID) {
            new Pipelet('RemoveProductList').execute({
                ProductList: ProductList
            });
        }
    }


    start();
}


/**
 * Creates a gift registry. Calls the {@link module:controllers/GiftRegistry~createOne|createOne} function.
 */
function create() {
    createOne();
}


// function updateAll() {
//     var currentForms = session.forms;

//
//     for (var i = 0; i < currentForms.giftregistry.items.length; i++) {
//         var item = currentForms.giftregistry.items[i];
//         if (!Form.get(item).copyTo(item.object)) {
//             return {
//                 error: true
//             };
//         }
//     }
// }


/*
 * Web exposed methods
 */
/** Gift registry event handler.
 * @see module:controllers/GiftRegistry~confirmation */
exports.Confirmation = guard.ensure(['post', 'https'], confirmation);
/** Deletes a gift registry.
 * @see module:controllers/GiftRegistry~confirmation */
exports.Delete = guard.ensure(['get', 'https'], Delete);
/** Event handler for gift registry addresses.
 * @see module:controllers/GiftRegistry~editAddresses */
exports.EditAddresses = guard.ensure(['post', 'https'], editAddresses);
/** Event handler for gift registry addresses.
 * @see module:controllers/GiftRegistry~eventParticipant */
exports.EventParticipant = guard.ensure(['post', 'https'], eventParticipant);
/** Event handler for gift registry search.
 * @see module:controllers/GiftRegistry~searchGiftRegistry */
exports.SearchGiftRegistry = guard.ensure(['post'], searchGiftRegistry);
/** Provides actions to edit a gift registry event.
 * @see module:controllers/GiftRegistry~selectProductListInteraction */
exports.SelectProductListInteraction = guard.ensure(['post', 'https'], selectProductListInteraction);
/** Event handler for gift registry navigation.
 * @see module:controllers/GiftRegistry~showPurchasesInteraction */
exports.ShowPurchasesInteraction = guard.ensure(['post', 'https'], showPurchasesInteraction);
/** Looks up a gift registry by its public UUID.
 * @see module:controllers/GiftRegistry~showRegistryByID */
exports.ShowRegistryByID = guard.ensure(['get', 'https'], showRegistryByID);
/** Event handler for gift registry interactions.
 * @see module:controllers/GiftRegistry~showRegistryInteraction */
exports.ShowRegistryInteraction = guard.ensure(['get', 'https'], showRegistryInteraction);
/** Controls the login that is required to access gift registry actions.
 * @see module:controllers/GiftRegistry~submitFormLanding */
exports.SubmitFormLanding = guard.ensure(['post', 'https'], submitFormLanding);
/** Creates or searches for a gift registry.
 * @FIXME Why is this exported as lowercase?
 * @see module:controllers/GiftRegistry~registrymain */
exports.registrymain = guard.ensure(['post', 'https'], registrymain);
/** Renders a list of gift registries associated with the current customer.
 * @see module:controllers/GiftRegistry~start */
exports.Start = guard.ensure(['get', 'https', 'loggedIn'], start, {scope: 'giftregistry'});
/** Adds a product to the gift registry.
 * @see module:controllers/GiftRegistry~addProduct */
exports.AddProduct = guard.ensure(['get', 'https', 'loggedIn'], addProduct);

/*
 * Local methods
 */
/** Attempts to replace a product in the gift registry.
 * @see module:controllers/GiftRegistry~replaceProductListItem */
exports.ReplaceProductListItem = replaceProductListItem;
/** Searches a gift registry by various parameters.
 * @see module:controllers/GiftRegistry~search */
exports.Search = search;
/** Renders the gift registry details page.
 * @see module:controllers/GiftRegistry~showRegistry */
exports.ShowRegistry = showRegistry;
