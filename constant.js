exports.sendNotification = function(data) {
    var headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": "Basic NjU1ODI4YTEtNDA1OC00ZmZjLWFjMTQtODgzNjViNmUzMDg4"
    };
    
    var options = {
      host: "onesignal.com",
      port: 443,
      path: "/api/v1/notifications",
      method: "POST",
      headers: headers
    };
    
    var https = require('https');
    var req = https.request(options, function(res) {  
      res.on('data', function(dataaa) {
        console.log("Response:");
        console.log(JSON.parse(dataaa));
      });
    });
    
    req.on('error', function(e) {
      console.log("ERROR:");
      console.log(e);
    });
    
    req.write(JSON.stringify(data));
    req.end();
}

exports.appId = '6ca927f8-55b5-4c92-b046-0aa1016eac25';