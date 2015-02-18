
var DBO = require("./DBO.js");

DBO.connect({host: "127.0.0.1",	user: "startupgame", password : "wwwstartupgame", database: "startupgame"});

function Player() {

}
Player.prototype.doSomething = function() {
	console.log(this.data.name + " owns the company " + this.data.companyName);
}


var player = new Player();
player.data = new DBO.table("player", "name", "Johan", doStuff);


function doStuff() {
	player.doSomething();

	console.log("money:" + player.data.money);
	
	player.data.money = 42000;
	
	console.log("money:" + player.data.money);
	
}
