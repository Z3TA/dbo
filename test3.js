
var DBO = require("./DBO.js");

DBO.connect({host: "127.0.0.1",	user: "startupgame", password : "wwwstartupgame", database: "startupgame"});

DBO.cfg.asyncListsCreation = true;

function Player() {
}
Player.prototype.showShareHolders = function() {
	var player = this;
	
	for(var share in player.shareholders) {
		showInfo( player.shareholders[share] );
	}
	
	function showInfo(share) {
	
		var owner = share.owner;
		
		console.log(owner.data.name + " owns " + share.data.shares + " for a total worth of " + share.data.price);
	}

}


var players,
	shares,
	me = 2,
	arne = 11;

players = new DBO.list({tbl: "player", fun: Player}, function() {
	console.log("Got player list. My name is " + players[me].data.name);
	
	shares = new DBO.list({tbl: "shares"}, function() {
		console.log("Got shares list");
		
		players.link({list: shares, key: "player", attribute: "shareholders"});
		players.link({list: shares, key: "owner", attribute: "investments"});
	

		players[me].showShareHolders();
	
		
	});

	
});

console.log("jajaj");

