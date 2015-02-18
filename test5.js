
var DBO = require("DBO");


DBO.connect({host: "127.0.0.1",	user: "ubuntudev", password : "123", database: "webgameexchange"});

//var views = new DBO.log({table: "views", keys: ["publisher", "advertiser"]});
var clicks = new DBO.log({table: "clicks", keys: ["publisher", "advertiser"]});

//sites = new DBO.list({table: "sites"});
	
wait(function() {

	console.log( "Count=" + clicks.count({advertiser: 102}) );

	//views.add({publisher: 200, advertiser: 102, ip: "127.0.0.3"});
	//wait();

});



function wait(callback) {
	setTimeout(function() {
		console.log(JSON.stringify(clicks, null, 4));
		
		if(callback) callback();
		
	}, 1000);
}
	


//DBO.disconnect();