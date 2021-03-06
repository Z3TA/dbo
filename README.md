# DBO: Persistent data abstraction module

Your DBA guy will be happy you'll be using a SQL relational database, and your JS hackers will be happy about using no-SQL. And you will be happy about getting the advantage of both!

This module for nodejs/iojs makes it easier to manage data and make data persistent between app restarts.

Database selects, updates and inserts will be done automatically! 

An object oriented approach is not required but recommended.
Constructor functions can be passed and objects will be constructed automatically. Getters and setters work like normal, with the added benefits of the data being persistent and stored in a database, and on a hard drive, but accessed from memory. Data is updated immediately and sent to the database asynchronously in the background.

Note that, in order for this module to work, you must have access to a mySQL database and you have to create the database schema! This module will not ALTER TABLE or CREATE TABLE.

It (currently) only works with mySQL databases.


Here's a JavaScript example of how you might use this module:
```
var Player = function() {
}
Player.prototype.takeDamage = function(damage) {
	this.data.health -= damage;
};

var Weapon = function() {
}
Weapon.prototype.fireAt(otherPlayer) {
	otherPlayer.takeDamage(this.damage);
}

var DBO = require("dbo");

DBO.connect({host: "127.0.0.1",	user: "nodedeamon", password : "12345", database: "ultrashooter"});


// Load data
var players = new DBO.List({table: "players", fun: Player, key: "name"});
var weapons = new DBO.List({table: "weapons", fun: Weapon, key: "id"});

// Link weapons to the players
players.link({list: weapons, key: "player_name"});

// Update something
players["Arnold"].data.age = 65;

// Insert another player
players.add({name: "Napoleon", age: 45});

// What weapons does Arnold have?
var player = players["Arnold"],
	weapon;
for(var id in player.weapons) {
	weapon = player.weapons[id];
	console.log(weapon.data.name + " with " + weapon.data.damage + " damage");
}

// Fire that weapon
weapon.fireAt(players["Napoleon"]);
```

You only have to remember one function (DBO.List) to make your data persistent.

The "data" will always be under .data, stored as an associative array with key, value pairs. We choose to have all "data" under a data attribute to make sure other attributes or functions are not overwritten.

Make sure you use unique identifiers (primary keys) like name, or id (with auto-increment) when you design the database schema!

See the <a href="http://dbo.js.org/">Documentation</a> for more info.

