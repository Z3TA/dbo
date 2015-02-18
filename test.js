



var DBO = require("./DBO.js");


var players = new DBO.list("player", Player, "name", getIncome);
console.log("Done getting players!");


function Player() {

}
Player.prototype.doSomething = function() {
	console.log(this.data.companyName);
}

function getIncome() {

	console.log("Heres the income:");

	for(var name in players) {
	
		if(players.hasOwnProperty(name)) {
		
			console.log(name);
			console.log(players[name].data.income);
		}
	}
	
	players.add({name: "Liponn"});
}



// #################################################################
var player = new Player();
player.data = new DBO.table("player", "name", "Johan", doStuff);


function doStuff() {
	player.doSomething();
	
	player.data.set("money", 500000);
	
	console.log("money:" + player.data.money);
	
}



function disconnect() {
	global.db.end(function(err) {
	  console.log("Mysql connection ended!");
	});
}