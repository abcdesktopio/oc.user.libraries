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

const { promises:dnsPromises } = require("dns");

const dico = new Map();

const resolveFQDN = async (addr = '', seekIp = '', useCache = false) => {
    const domains = await dnsPromises.resolveSrv('*.' + addr);
    let ips = [];
    if (useCache) {
        const promises = [];
        for (const domain of domains) {
            if (dico.has(domain.name)) {
                ips.push(dico.get(domain.name));
            } else {
                const pending = dnsPromises.lookup(domain.name)
                                            .then(ip => { dico.set(domain.name, ip); return ip; });
                promises.push(pending);
            }
        }
        ips = ips.concat(await Promise.all(promises));
    } else {
        ips = await Promise.all(domains.map(d => dnsPromises.lookup(d.name)));
    }

    for (const { address } of ips) {
        if (address.includes(seekIp)) {
            return true;
        }
    }

    return false;
};

const search = async (ip, seekIp, useCache = true) => {
    let addresses;

    if (useCache) {
        if (!dico.has(ip)) {
            dico.set(ip, await dnsPromises.reverse(ip));
        }
        addresses = dico.get(ip);
    } else {
        addresses = await dnsPromises.reverse(ip);
    }

    const promises = [];
    for (const addr of addresses) {
        promises.push(resolveFQDN(addr, seekIp, useCache));
    }

    const results = await Promise.all(promises);
    return results.includes(true);
};

const searchbyname = async ( ip, useCache = true ) => {
    // do 
    // reverse to the removeip 10-244-0-72.nginx.abcdesktop.svc.cluster.local
    // remove 10-244-0-72.
    // get nginx.abcdesktop.svc.cluster.local
    // run nslookup nginx.abcdesktop.svc.cluster.local
    // MUST MATCH WITH process.env.NGINX_SERVICE_HOST
      
    let addresses;

    // for example
    // ipFilter.searchbyname 10.244.0.72
    if (useCache) {
        if (!dico.has(ip)) {
            dico.set(ip, await dnsPromises.reverse(ip));
        }
        addresses = dico.get(ip);
    } else {
        addresses = await dnsPromises.reverse(ip);
    }
    
    if (addresses && addresses.length < 1)
        return false;

    // addresses= [ '10-244-0-72.nginx.abcdesktop.svc.cluster.local' ]

    const fqdn = addresses[0];
    // fqdn= 10-244-0-72.nginx.abcdesktop.svc.cluster.local
    const hostname_index = fqdn.indexOf('.') + 1;
    if ( hostname_index == 0 )
        return false;

    // service_fqdn= nginx.abcdesktop.svc.cluster.local
    // remote the hostname from the fqdn
    const service_fqdn = fqdn.substr(hostname_index);
    const services = await dnsPromises.resolve(service_fqdn);    
    const breturn = services.includes( process.env.NGINX_SERVICE_HOST );
    if (!breturn) {
            console.error( 'services=', services, 'does not contain process.env.NGINX_SERVICE_HOST=', process.env.NGINX_SERVICE_HOST);
    }
    return breturn;
};


module.exports = {
    search,
    searchbyname
};
