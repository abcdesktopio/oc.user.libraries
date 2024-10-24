/*
* Software Name : abcdesktop.io
* Version: 0.2
* SPDX-FileCopyrightText: Copyright (c) 2020-2021 Orange
* SPDX-License-Identifier: GPL-2.0-only
*
* This software is distributed under the GNU General Public License v2.0 only
* see the "license.txt" file for more details.
*
* Author: abcdesktop.io team
* Software description: cloud native desktop service
*/

const ipFilter = require('./ip-filter.js');

const assertIp = async remoteIp => {

    // read the DISABLE_REMOTEIP_FILTERING env var if set, REMOTEIP_FILTERING is enabled by default 
    const isDisableRemoteIPFiltering = process.env.DISABLE_REMOTEIP_FILTERING || 'disabled';	
	
    // skip filtering if force disable remote IP filtering 
    if( isDisableRemoteIPFiltering === 'enabled' )
	return;

    // We check caller IP before accepting connexion
    // if('NGINX_SERVICE_HOST' in process.env) {
    //     if (process.env.NGINX_SERVICE_HOST === remoteIp) {
    //        return;
    //    }
    //    const found = await ipFilter.search(process.env.NGINX_SERVICE_HOST, remoteIp)
    //    if (!found) {
    //        throw 403;
    //    }
    //} else {

    if ('NGINX_SERVICE_HOST' in process.env || 'HTTP_ROUTER_SERVICE_HOST' in process.env) {
    	const found = await ipFilter.searchbyname(remoteIp)
    	if (!found) {
		console.error("This is an error. failed to match ipFilter.searchbyname", remoteIp, 'returns', found);
		// by pass 
        	throw 403;	      
    	}
    } else {
	console.error("This is an error. HTTP_ROUTER_SERVICE_HOST or NGINX_SERVICE_HOST is not defined in this process");
    }
};

const middleWareExpressIpFiler = (req, res, next) => {
    console.log(req.path);
    const remoteIp = req.connection.remoteAddress.replace('::ffff:', '');
    console.log('remoteIp: ' + remoteIp);
    assertIp(remoteIp)
        .then(next)
        .catch(() => {
            console.log('Forbiden ip: ' + remoteIp);
            res.sendStatus(403);
        });
};

/**
 * @param {Express} app 
 * @param {Number} PORT
 * @param {string} messageOnListening 
 */
const listenDaemonOnContainerIpAddr = (app, PORT, messageOnListening = '') => {
    const onListening = () => { console.log(messageOnListening); };

    if (isNaN(PORT)) {
        console.error(`The Port number wasn't correctly provided, a number is expected but [${PORT}] was provided`);
        process.exit(1);
    }

    // replaced by process.env.DISABLE_REMOTEIP_FILTERING
    // if (process.env.TESTING_MODE !== 'true') {
    //     app.use(middleWareExpressIpFiler);
    // }

    if ('CONTAINER_IP_ADDR' in process.env) {
        app.listen(PORT, process.env.CONTAINER_IP_ADDR, onListening);
    } else {
        console.warn('Be careful [CONTAINER_IP_ADDR] is not provided then listen on 0.0.0.0');
        app.listen(PORT, '0.0.0.0',onListening);
    }
};

/**
 * 
 * @param {*} request 
 */
const hookFastifyIpFilter = async (request) => {
    const remoteIp = request.connection.remoteAddress.replace('::ffff:', '');
    console.log(request.path);
    console.log('remoteIp: ' + remoteIp);

    try {
        await assertIp(remoteIp);
    } catch(e) {
        console.error(e);
        console.log('Forbiden ip: ' + remoteIp);
        const err = new Error()
        err.statusCode = 403;
        err.message = 'Ip forbiden';
        throw err;
    }
};

/**
 * 
 * @param {*} fastify 
 * @param {string} PORT 
 * @param {string} messageOnListening 
 */
const listenDaemonOnContainerIpAddrUsingFastify = async (fastify, PORT, messageOnListening = '')  => {
    if (isNaN(PORT)) {
        console.error(`The Port number wasn't correctly provided, a number is expected but [${PORT}] was provided`);
        process.exit(1);
    }

    // replaced by process.env.DISABLE_REMOTEIP_FILTERING
    // if (process.env.TESTING_MODE !== 'true') {
    //    fastify.addHook('onRequest', hookFastifyIpFilter);
    // }

    let containerIpAddress;
    if ('CONTAINER_IP_ADDR' in process.env) {
        containerIpAddress = process.env.CONTAINER_IP_ADDR;
    } else {
        console.warn('Be careful [CONTAINER_IP_ADDR] is not provided then listen on 0.0.0.0');
        containerIpAddress = '0.0.0.0';
    }

    fastify.setErrorHandler((error, _, reply) => {
        if (error.validation) {
          reply.status(422).send(error);
        }
    });

    try {
	console.log( `fastify.listen( ${PORT}, ${containerIpAddress} )` );
        await fastify.listen(PORT, containerIpAddress);
        console.log(messageOnListening);
    }
    catch (err) {
	console.log( 'fastify.listen error existing process' );    
        fastify.log.error(err);
        process.exit(1);
    }
};

module.exports = {
    assertIp,
    middleWareExpressIpFiler,
    listenDaemonOnContainerIpAddr,
    listenDaemonOnContainerIpAddrUsingFastify,
};
