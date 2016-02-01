'use strict';

/**
 * Controller that handles source code redirects.
 *
 * @module controllers/SourceCodeRedirect
 */

var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');

/**
 * Handles source code redirects. If the redirect succeeds, renders the redirect (util/redirect template).
 * If the redirect fails, calls the {@link module:controllers/Home~Show|Home controller Show function}.
 */
function start() {
    var sourceCodeRedirectURLResult = new dw.system.Pipelet('SourceCodeRedirectURL').execute();
    if (sourceCodeRedirectURLResult.result === PIPELET_ERROR) {
        app.getController('Home').Show();
        return;
    }
    var location = sourceCodeRedirectURLResult.Location;

    app.getView().render('util/redirect', {
        Location: location
    });
}

/*
 * Web exposed methods
 */
/** Handles source code redirects.
 * @see module:controllers/SourceCodeRedirect~start */
exports.Start = guard.ensure(['get'], start);