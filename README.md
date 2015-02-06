# DBO: 

## A persistant data abstraction module

Your DBA guy will be happy you'll be using a SQL relational database, and your JS hackers will be happy about using no-SQL. And you will be happy about getting the advantage of both!

This module for nodejs/iojs makes it easier to manage data and make it persistant between app restarts.

Database selects, updates and inserts will be done automatically! An object oriented aproach is not required but recommended.
Constructor functions can be passed and objects will be constructed automatically. Getters and setters work like normal, with the added benefits of the data being persistant and stored in a database, and on a hard drive, but accessed from memory. Data is updated immediately and sent to the database asynchronously in the background.

Note that, in order for this module to work, you must have acccess to a mySQL database and you have to create the datbase schema! This module will not ALTER TABLE or CREATE TABLE.

It (currently) only works with mySQL databases.

Here an JavaScript Example of how you might use this module:
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

var DBO = require("DBO");

// Load data
var players = new DBO.list({tbl: "players", fun: Player, key: "name"});
var weapons = new DBO.list({tbl: "weapons", fun: Weapon, key: "id"});

// Link the data for easy access
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

You only have to remember function (DBO.list) to make your data persistant.

The "data" will always be under .data, stored as an assosiative array with key, value pairs. We choose to have all "data" under a data attribute to make sure other attributes or functions are not overwritten.

DBO.list can .add, .link and .kill. And is also a assosiative array with key -value pairs. But with the values being objects constructed by specified constructor (function), witch will get a DBO.table data attribute.  

Make sure you use unique identifiers (Primary keys) like name, or id (with auto-increment) when you design the database schema!

See the documentation for more info.

