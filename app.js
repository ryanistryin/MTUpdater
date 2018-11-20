var portscanner = require('portscanner')
var iprange = require('iprange');
var client = require('scp2')




var range = iprange('172.16.1.253/32');
var PORT = 8291
var MTMinimumVersion = '6408'
var username = 'admin'
var password = ''


for (let index = 0; index < range.length; index++) {
    portscanner.checkPortStatus(PORT, range[index], function (error, status) {
        if (status == 'open') {
            console.log('Checking HOST[' + range[index] + '] for open PORT[' + PORT + '] status is ' + status)
            MTDetails(range[index], username, password, function (err, MTDetailsResult) {
                if (err) {
                    console.log('HOST[' + range[index] + '], we were unable to login, check username/password combination or check that API service is active!', err)
                } else {
                    //remove any '.' from version, so we can compare it to the minimum required versions
                    MTDetailsResult.version = MTDetailsResult.version.split('.').join("");
                    console.log('HOST[' + range[index] + '],RouterOS version:' + MTDetailsResult.version)
                    console.log('HOST[' + range[index] + '],RouterOS platform:' + MTDetailsResult.platform)


                    if (MTDetailsResult.version < MTMinimumVersion) {
                        var platform = MTDetailsResult.platform
                        //device needs to be upgraded.
                        MTUpdate(range[index], username, password, platform, function (err) {
                            if (err) {
                                console.log('HOST[' + range[index] + '], unable to upload software for this host, platform[' + platform + ']', err)
                            } else {
                                MTReboot(range[index], username, password, platform, function (err) {
                                    if (err) {
                                        console.log('HOST[' + range[index] + '], unable to reboot host', err)
                                    } else {
                                        console.log('HOST[' + range[index] + '] software uploaded & device is rebooting!', )
                                    }
                                })

                            }
                        })
                    } else {
                        //device is on a correct version
                        console.log('HOST[' + range[index] + '],device is on the correct software version.', )
                    }
                }
            })
        }
    })
}


function MTDetails(ip, username, password, callback) {

    const RouterOSClient = require('routeros-client').RouterOSClient;
    const api = new RouterOSClient({
        host: ip,
        user: username,
        password: password
    });

    api.connect().then((client) => {
        client.menu("/system package print").getOnly().then((result) => {
            console.log('#MTDetails => ',result); // Mikrotik
            result.name = result.name.split('routeros-').join("");
            api.close();
            return callback(false, { version: result.version, platform: result.name })
        }).catch((err) => {
            console.log(err); // Some error trying to get the identity
            return callback(err)
        });

    }).catch((err) => {
        console.log('#MTDetails => Caught some error')
        return callback(err)
    });
}

function MTUpdate(ip, username, password, platform, callback) {
    var client = require('scp2')
    client.scp(platform + '/', username + ':' + password + '@' + ip + ':/', function (err) {
        if (err) {
            return callback(err)
        } else {
            return callback(false)
        }
    })
}

function MTReboot(ip, username, password, platform, callback) {

    var RouterOSClient = require('routeros-client').RouterOSClient;

    var api = new RouterOSClient({
        host: ip,
        user: username,
        password: password
    });

    api.connect().then((client) => {
        var rootMenu = client.menu("/system");
        rootMenu.exec("reboot", {})
        .then((response) => {
            // Backup done!
            api.close();
            api.disconnect();
            console.log(response);
            console.log('#MTReboot => Backup done')
        }).catch((err) => {
            api.close();
            api.disconnect();
            console.log('#MTReboot => Caught some error2')
            // Error exporting or backing up
            console.log(err);
        });


    }).catch((err) => {
        console.log('#MTReboot => Caught some error')
        return callback(err)
    });

    api.on('error', (err) => {
        return callback(false)
        // console.log('Caught Error=>', err); // Some error that ocurred when already connected
    });


}
