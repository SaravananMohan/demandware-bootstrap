'use strict';
/**
 * Model for customer profiles.
 * @module models/ProfileModel */

/* API Includes */
var AbstractModel = require('./AbstractModel');
var ArrayList = require('dw/util/ArrayList');
var List = require('dw/util/List');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');

/**
 * Profile helper providing enhanced profile functionality
 * @class module:models/ProfileModel~ProfileModel
 */
var ProfileModel = AbstractModel.extend(
    /** @lends module:models/ProfileModel~ProfileModel.prototype */
    {
        /**
         * Retrieves the preferred customer address.
         *
         * @alias module:models/ProfileModel~ProfileModel/getPreferredAddress
         * @return {dw.customer.CustomerAddress} Address defined as the preferred address in the profile.
         */
        getPreferredAddress: function () {
            return this.object.getAddressBook().getPreferredAddress();
        },

        /**
         * Retrieves the default customer shipping address.
         * @alias module:models/ProfileModel~ProfileModel/getDefaultShippingAddress
         * @return {dw.customer.CustomerAddress} Address defined as the preferred address in the profile.
         */
        getDefaultShippingAddress: function () {
            return this.getPreferredAddress();
        },

        /**
         * Retrieves the default customer billing address.
         * @alias module:models/ProfileModel~ProfileModel/getDefaultBillingAddress
         * @return {dw.customer.CustomerAddress} Address defined as the preferred address in the profile.
         */
        getDefaultBillingAddress: function () {
            return this.getPreferredAddress;
        },

        /**
         * Sets the default customer shipping address.
         *
         * @alias module:models/ProfileModel~ProfileModel/setDefaultShippingAddress
         * @param {CustomerAddress} address  new preferred address to be set.
         */
        setDefaultShippingAddress: function (address) {
            if (this.object instanceof dw.customer.Profile && this.object.addressBook) {
                this.object.addressBook.setPreferredAddress(address);
            }
        },

        /**
         * Sets the default customer billing address.
         *
         * @alias module:models/ProfileModel~ProfileModel/setDefaultBillingAddress
         * @param {dw.customer.CustomerAddress} address new default billing address.
         */
        setDefaultBillingAddress: function (address) {
            if (this.object instanceof dw.customer.Profile && this.object.addressBook) {
                this.object.addressBook.setPreferredAddress(address);
            }
        },

        /**
         * Checks if address is the default shipping address.
         *
         * @alias module:models/ProfileModel~ProfileModel/isDefaultShippingAddress
         * @param {dw.customer.CustomerAddress} address address to check
         * @return {Boolean} true if the address is the default shipping address.
         */
        isDefaultShippingAddress: function (address) {
            var defaultShippingAddress = this.getDefaultShippingAddress();
            return defaultShippingAddress && address && defaultShippingAddress.ID === address.ID;
        },

        /**
         * Checks if the address is the default billing address.
         *
         * @alias module:models/ProfileModel~ProfileModel/isDefaultBillingAddress
         * @param {CustomerAddress} address address to check
         * @return {Boolean} true if the address is the default billing address.
         */
        isDefaultBillingAddress: function (address) {
            var defaultBillingAddress = this.getDefaultBillingAddress();
            return defaultBillingAddress && address && defaultBillingAddress.ID === address.ID;
        },

        /**
         * Adds the given address to the address book of the current profile. The address
         * attribute "city" is used to generate the address ID within the address book.
         *
         * @transactional
         * @alias module:models/ProfileModel~ProfileModel/addAddressToAddressBook
         * @param {Object }addressToAdd Address with following attributes:
         * <ul><li> address1 </li>
         * <li> address2 </li>
         * <li> city </li>
         * <li> companyName </li>
         * <li> countryCode </li>
         * <li> firstName </li>
         * <li> lastName </li>
         * <li> postalCode </li>
         * <li> postBox </li>
         * <li> stateCode </li></ul>
         * <b>Note:</b> dw.customer.CustomerAddress objects can be passed and meet this criteria.
         * @returns {dw.customer.CustomerAddress} Address object that is added to the address book.
         */
        addAddressToAddressBook: function (addressToAdd) {
            var addressBook = this.getAddressBook();
            // Gets a possible equivalent address from the address book
            var that = this;

            dw.system.Transaction.wrap(function () {
                var address;
                if (addressToAdd) {
                    var usedAddress;
                    //Checks if the address already exists in the address book
                    for (var i = 0; i < addressBook.addresses.length; i++) {
                        usedAddress = addressBook.addresses[i];
                        if (usedAddress.isEquivalentAddress(addressToAdd)) {
                            address = usedAddress;
                            break;
                        }
                    }

                    // Creates the new address and copies the address attributes.
                    if (!address) {
                        // Gets a unique address ID.
                        var addressID = that.determineUniqueAddressID(addressToAdd.city);

                        // Checks on empty address ID.
                        if (!addressID) {
                            dw.system.Logger.debug('Cannot add address to address book, with empty address ID.');
                            return;
                        } else {
                            address = addressBook.createAddress(addressID);
                            address.setFirstName(addressToAdd.firstName);
                            address.setLastName(addressToAdd.lastName);
                            address.setAddress1(addressToAdd.address1);
                            address.setAddress2(addressToAdd.address2);
                            address.setCity(addressToAdd.city);
                            address.setPostalCode(addressToAdd.postalCode);
                            address.setStateCode(addressToAdd.stateCode);
                            address.setCountryCode(addressToAdd.countryCode.value);
                        }
                    }

                    // Updates the phone in either the equivalent found address
                    // or in the newly created address.
                    address.setPhone(addressToAdd.phone);
                }
                return address;
            });
        },

        /**
         * Determines a unique address ID for an address to be saved in the profiles address book. The function first
         * checks the city as the candidate ID or appends a counter to the city (if already used as address ID) and then
         * checks the existence of the resulting ID candidate. If the resulting ID is unique this ID is returned, if not
         * the counter is incremented and checked again.
         *
         * @param {String} city an address ID. Preferably the city used in the address. Must not be null.
         * @alias module:models/ProfileModel~ProfileModel/determineUniqueAddressID
         * @returns {String | null} Returns a unique address ID. If the city parameter is null, returns null.
         */
        determineUniqueAddressID: function (city) {
            var counter = 0;

            // Checks if the attribute "city" is set and has a value.
            if (city) {
                // Initializes the candidate ID.
                var candidateID = city;
                var existingAddress = null;

                while (existingAddress === null) {
                    existingAddress = this.getAddressBook().getAddress(candidateID);
                    if (existingAddress !== null) {
                        // This ID is already taken, increment the counter
                        // and try the next one.
                        counter++;
                        candidateID = city + '-' + counter;
                        existingAddress = null;
                    } else {
                        return candidateID;
                    }
                }
            }

            return null;
        },

        /**
         * Validates payment instruments and returns valid payment instruments.
         *
         * @alias module:models/ProfileModel~ProfileModel/validateWalletPaymentInstruments
         * @param {String} countryCode Billing country code or null.
         * @param {Number} amount Payment amount to check valid payment instruments for.
         * @returns {ArrayList} Returns an array with the valid PaymentInstruments.
         */
        validateWalletPaymentInstruments: function (countryCode, amount) {



            //var paymentInstruments = this.getWallet().getPaymentInstruments()
            var customer = this.getCustomer();
            var paymentInstruments = new ArrayList();

            var GetCustomerPaymentInstrumentsResult = new dw.system.Pipelet('GetCustomerPaymentInstruments').execute({
                Customer: customer
            });

            if (GetCustomerPaymentInstrumentsResult.result !== PIPELET_ERROR) {
                paymentInstruments = GetCustomerPaymentInstrumentsResult.PaymentInstruments;
            }

            // Gets applicable payment methods.
            var methods = PaymentMgr.getApplicablePaymentMethods(customer, countryCode, amount);

            // Gets applicable payment cards from CREDIT_CARD payment method.
            var ccMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
            var cards = ccMethod !== null ? ccMethod.getApplicablePaymentCards(customer, countryCode, amount) : List.EMPTY_LIST;

            // Collects all invalid payment instruments.
            var validPaymentInstruments = new ArrayList(paymentInstruments);
            var invalidPaymentInstruments = new ArrayList();

            for (var i = 0; i < paymentInstruments.length; i++) {
                var pi = paymentInstruments[i];
                // Ignores gift certificate payment instruments.
                if (PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals(pi.paymentMethod)) {
                    continue;
                }

                // Gets a payment method.
                var method = PaymentMgr.getPaymentMethod(pi.getPaymentMethod());

                // Checks whether payment method is still applicable.
                if (method !== null && methods.contains(method)) {
                    // In case of method CREDIT_CARD, check payment cards
                    if (PaymentInstrument.METHOD_CREDIT_CARD.equals(pi.paymentMethod)) {
                        // Gets payment card.
                        var card = PaymentMgr.getPaymentCard(pi.creditCardType);

                        // Checks whether payment card is still applicable.
                        if (card !== null && cards.contains(card)) {
                            continue;
                        }
                    } else {
                        // Continues if method is applicable.
                        continue;
                    }
                }

                // Collects invalid payment instruments.
                invalidPaymentInstruments.add(pi);
                validPaymentInstruments.remove(pi);
            }

            if (!invalidPaymentInstruments.empty) {
                return {
                    InvalidPaymentInstruments: invalidPaymentInstruments,
                    ValidPaymentInstruments: validPaymentInstruments
                };
            } else {
                return {
                    ValidPaymentInstruments: validPaymentInstruments
                };
            }

        }

    });

/**
 * Gets a new instance of a profile.
 * @alias module:models/ProfileModel~ProfileModel/get
 * @param {String | Object } parameter Customer number of the profile to get if a string or
 * the profile object to wrap with a ProfileModel if an object.
 */
ProfileModel.get = function (parameter) {
    var obj = null;
    if (typeof parameter === 'string') {
        obj = dw.customer.CustomerMgr.getProfile(parameter);
    } else if (typeof parameter === 'object') {
        obj = parameter;
    } else {
        obj = customer.profile;
    }
    return new ProfileModel(obj);
};


/** The profile class */
module.exports = ProfileModel;
