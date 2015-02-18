

var DBO = require("DBO"),
	sites,
	search;


DBO.connect({host: "127.0.0.1",	user: "ubuntudev", password : "123", database: "webgameexchange"});

sites = new DBO.list({table: "sites"});
	
wait(function() {

	search = sites.search({name: "Visual Utopia"});
	
	for(var id in search) {
		
		console.log(search[id].data.name);
	}

});



function wait(callback) {
	setTimeout(function() {
		console.log(JSON.stringify(sites, null, 4));
		
		if(callback) callback();
		
	}, 1000);
}




//DBO.disconnect();