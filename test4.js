
var DBO = require("./DBO.js");

DBO.connect({host: "127.0.0.1",	user: "startupgame", password : "wwwstartupgame", database: "startupgame"});

function Player() {
}
Player.prototype.showShareHolders = function() {
	var player = this;
	
	for(var share in player.shareholders) {
		showInfo( player.shareholders[share] );
	}
	
	function showInfo(share) {
		console.log(share.owner.data.name + " owns " + share.data.shares + 
		" share with a total worth of " + share.data.price);
	}
}


var players = new DBO.list({tbl: "player", fun: Player});

var shares = new DBO.list({tbl: "shares"});

players.link({list: shares, key: "player", attribute: "shareholders", pp: "issuer"});
players.link({list: shares, key: "owner", attribute: "investments"});

var playerId = 2;

players[playerId].showShareHolders();

