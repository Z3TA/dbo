
/*
The MIT License (MIT)

Copyright (c) 2015 Johan Zetterberg (Website: http://joha.nz/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


"use strict";

// Dependencies
var util = require("util"),
	mysql = require("mysql"),
	cli = require("cli-color"),
	deasync = require("deasynca");



// Private variables and funtions ...

var database,
	db_config = {host: "127.0.0.1",	user: "startupgame", password : "wwwstartupgame", database: "startupgame"},
	dbRetry = 2000,
	listedTables = [],
	debug = {};

debug.warn = function(msg) {
	if(DBO.debug.showWarnings) {
		debug.log(msg, "yellow");
	}
}
debug.sql = function(sql) {
	if(DBO.debug.showSQL) {
		debug.log(sql, "cyan");
	}
}
debug.log = function(msg, color) {
	if(DBO.debug.useColors) {
		console.log(cli[color](msg));
	}
	else {
		console.log(msg);
	}
}

function handleDbDisconnect() {

	// Recreate the connection, since the old one cannot be reused.
	database = mysql.createConnection(db_config);    
                                                    
	database.connect(function(err) {                 
		if(err) {
			/* 
				The server is either down or restarting (takes a while sometimes).
				We introduce a delay before attempting to reconnect, to avoid a hot loop, and to allow our node script to process asynchronous requests in the meantime.
				If you're also serving http, display a 503 error.
				Connection to the MySQL server is usually lost due to either server restart, or a connnection idle timeout (the wait_timeout
			*/
			debug.warn("Error when connecting to the database!\n", err, "Trying again in " + dbRetry + "ms ...");
			setTimeout(handleDbDisconnect, dbRetry);
		}
	});

	database.on("error", function(err) {
		if(err.code === "PROTOCOL_CONNECTION_LOST") {
			handleDbDisconnect();
		}
		else {             
			throw new Error("Database error: ", err);
		}
	});
}



// Public objects and functions ...

var DBO = {}; 

DBO.debug = {showSQL: true, showWarnings: true, useColors: true};

DBO.cfg = {pointToParentInLinks: true, asyncListsCreation: false};



DBO.connect = function(cfg) {
	db_config = cfg;
	
	if(database) {
		throw new Error("Already connected to the database!");
	}
	else {
		handleDbDisconnect()
	}
}

DBO.disconnect = function(callback) {
	database.end(function(err) {
		if(callback) callback();
		
		if(err) throw err;

	});
}


DBO.table = function(arg, callback) {
	
	var table = this,
		dbTable = arg.table, 
		identifier = arg.key,
		identifierValue = arg.keyValue;
	
	if(!dbTable) {
		throw new Error("No table defined in argument " + JSON.stringify(arg) + "!");
	}
	else if(identifier) {
		throw new Error("No key defined in argument " + JSON.stringify(arg) + "!");
	}
	else if(identifierValue) {
		throw new Error("No keyValue defined in argument " + JSON.stringify(arg) + "!");
	}
	
	Object.defineProperty(table, "__table", { value: dbTable, enumerable: false });
	Object.defineProperty(table, "__identifier", { value: identifier, enumerable: false });

	var query = database.query("SELECT * FROM ?? WHERE ?? = ?", [dbTable, identifier, identifierValue], function(err, rows) {
		if (err) throw new Error(err);

		if(rows.length == 1) {
			
			var data = rows[0];
			
			table.init(data);

		}
		else {
			throw new Error("Expected one row!");
		}
		
		if(callback) callback();
	});
	
	debug.sql(query.sql);

}



DBO.table.prototype.init = function(data, dbTable, identifier) {
	var table = this;
	
	if(dbTable && !table["__table"]) {
		Object.defineProperty(table, "__table", { value: dbTable, enumerable: false });
	}
	
	if(identifier && !table["__identifier"]) {
		Object.defineProperty(table, "__identifier", { value: identifier, enumerable: false });
	}
	
	for(var name in data) {
		table.define(name, data[name]);
	}
	
	// Object.keys(data).forEach(table.define);
	
}

DBO.table.prototype.define = function (name, currentValue) {

	var table = this,
		dbTable = table.__table,
		identifier = table.__identifier,
		identifierValue = table[identifier];
	
	//table[name] = data[name];
	Object.defineProperty( table, name, {
		get: function(){ return currentValue; },
		set: function(value){ 

			// Datbase queries are costly, so check if the value actually updates before updating it.
			if(currentValue != value) {
				var query = database.query("UPDATE ?? SET ?? = ? WHERE ?? = ?", [dbTable, name, value, identifier, identifierValue], function(err, result) {
					if (err) throw new Error(err);
				});
				
				debug.sql(query.sql);
			}
			
			currentValue = value;
			
		},
		enumerable: true,
	});
}


DBO.list = function(arg, callback) {

	/*
		
		Creates a list of something, initiates and gives each item its data ...
		
	*/
	
	var list = this,
		data,
		name,
		dbTable = arg.tbl,
		constructor = arg.fun,
		identifier = arg.key,
		done = false;
		
	
	if(DBO.cfg.asyncListsCreation === false && callback) {
		throw new Error("Can not have a callback when DBO.cfg.asyncListsCreation is set to false!");
	}
	
	if(!identifier) {
		identifier = "id";
	}
	
	if(listedTables.indexOf(dbTable) > -1) {
		throw new Error("Dublicate list of " + dbTable + "!"); 
	}
	else {
		listedTables.push(dbTable);
	}
	
	var query = database.query("SELECT * FROM ??", [dbTable], function(err, rows) {
		if (err) throw new Error(err);
		var counter = 0;
		
		for(var i=0; i<rows.length; i++) {
			
			data = rows[i];
			
			name = data[identifier];
			
			if(!name) {
				throw new Error("No identifier (" + identifier + ") exist in " + dbTable + ". Please use one field as a primary key!");
			}
			
			if(constructor) {
				list[name] = new constructor(); // Important we use new here so that the object function is called.
			}
			else {
				list[name] = {};
			}
			
			list[name].data = Object.create(DBO.table.prototype); // We use Object.create here because we don't want to call the actual function. That would result in another datbase SELECT.
			
			list[name].data.init(data, identifier);
			
			/*
			for(var key in data) {
				list[name].data[key] = data[key];
			}
			*/
			
			/*
			list[name].data.__identifier = identifier;
			list[name].data.__identifierValue = data[identifier];
			*/
			
			Object.defineProperty(list[name].data, "__identifier", { value: identifier, enumerable: false });
			Object.defineProperty(list[name].data, "__identifierValue", { value: data[identifier], enumerable: false });
			
		}
		
		done = true;
		
		if(callback && DBO.cfg.asyncListsCreation) callback();
		
		
	});
	debug.sql(query.sql);
	
	Object.defineProperty(list, "__table", { value: dbTable, enumerable: false });
	Object.defineProperty(list, "__constructor", { value: constructor, enumerable: false });
	Object.defineProperty(list, "__identifier", { value: identifier, enumerable: false });
	Object.defineProperty(list, "__links", { value: [], enumerable: false });


	if(DBO.cfg.asyncListsCreation === false) {
		while(!done) {
			deasync.runLoopOnce();
		}
		
		if(callback) callback();
	}

}

DBO.list.prototype.add = function(values, callback) {
	var list = this,
		object,
		dbTable = list.__table,
		identifier = list.__identifier,
		identifierValue,
		async = (callback === false) ? false : true;
	

	if(list.__constructor) {
		object = new list.__constructor(); // We use new here so that the object function is called
	}
	else {
		object = {}; // New vanilla object
	}
		
	/* We can be sure that identifier has been defined and exists! Or DBO.list would have thrown an error when doing the database SELECT.
	   But if the identifier is not in the values, we have to wait for last inserted id before creating the new list object!
	*/
	
	if(values.hasOwnProperty(identifier)) {
		identifierValue = values[identifier];
		
		// Check for dublicate keys and throw an error if we find any
		if(list[identifierValue]) {
			throw new Error(identifier + " " + identifierValue + " already exist in the " + dbTable + "-list! " + identifier + " must be unique!");
		}
		
	}
	
	var query = database.query("INSERT INTO ?? SET ?", [dbTable, values], function(err, result) {
		if (err) throw new Error(err);
		
		if(!identifierValue) {
			identifierValue = result.insertId;
		}
		
		// We now got the identifierValue but have to wait for the data before inserting the new objec to the list ...
		
		// Make a SELECT to get All fields
		object.data = new DBO.table({tbl: dbTable, key: identifier, keyValue: identifierValue}, init);
		
	});
	debug.sql(query.sql);
	
	
	function init() {
	
		// We should now have all the data available!
	
		// Insert the new object to the list
		list[identifierValue] = object; 
	
		updateLinks();
		
		if(callback) callback();
	
	}
	
	
	
	function updateLinks() {
		// Keep the links up to date with the added object ...

		for(var i=0, link; i<list.__links.length; i++) {
			link = list.__links[i];
			
			updateLink(link);
			
		}
		
		function updateLink(link) {
			var parentList = link.list,
				key = link.key,
				attribute = link.attribute,
				keyValue = object.data[key];
			
			for(var index in parentList) {
				if(parentList.hasOwnProperty(index)) {
					if(index == keyValue) { // if player.name = army.owner
					
						// Link the new object
						parentList[index][attribute][identifierValue] = object;
					}
				}
			}
			
		}
	}
	
}


DBO.list.prototype.link = function(arg) {

	// {list: shares, key: "player", attribute: "shareholders"}

	var list = this,
		identifier = list.__identifier,
		otherList = arg.list,
		key = arg.key || list.__table,
		attribute = arg.attribute || otherList.__table,
		parentName = (typeof arg.pp === "string") ? arg.pp : key,
		pointToParent = (arg.pp == undefined) ? DBO.cfg.pointToParentInLinks : arg.pp;
	
	for(var i=0, link; i<otherList.__links.length; i++) {
		link = otherList.__links[i];
		
		// Check if there's already a link between the two lists using key
		if(link.list == list && link.key == key) {
			throw new Error("The two lists are already linked using " + key + " as " + link.attribute + "!");
		}
	}


	otherList.__links.push({key: key, list: list, attribute: attribute});

	
	for(var index in list) {
		if(list.hasOwnProperty(index)) {
			makeAttributeLinkFor(index);			
		}
	}
	
	function makeAttributeLinkFor(objectIndex) {
		
		var listObject = list[objectIndex],
			identifierValue = listObject.data[identifier];
		
		if(listObject[attribute]) {
			throw new Error(attribute + " in "  + objectIndex + " was going to be overwritten ... You probably don't want that, or there is a bug!");
		}
		else {
			listObject[attribute] = {};
		}
		

		
		
		
		for(var index in otherList) {
			if( otherList.hasOwnProperty(index) ) {
				
				if(!otherList[index].data.hasOwnProperty(key)) {
					throw new Error(index + " does not have the key/attribute: " + key + "!");
				}
				
				if(otherList[index].data[key] == identifierValue) {
				
					listObject[attribute][index] = otherList[index];
					
					
					if(pointToParent) {
						// Also make a pointer at the parent for easy access
						if(otherList[index][parentName]) {
							debug.warn("Key " + parentName + " in " + otherList.__table + " "  + index + " already exist!\n ... You might want to call DBO.link with pp: false or set DBO.cfg.pointToParentInLinks = false");
						}
						else {
							otherList[index][parentName] = listObject;
						}
					}
					
					
					
					
				}
			
			}
		}
		
		if(DBO.crazyJoin) {
			// Also make like a INNER JOIN
		}
		
	}

}



DBO.list.prototype.kill = function(keyValue) {

	var list = this
		dbTable = list__table,
		key = list__identifier;
	
	delete list[keyValue];
	
	var query = database.query("DELETE FROM ?? WHERE ?? = ?", [dbTable, key, keyValue], function(err, result) {
		if (err) throw new Error(err);
	});
	
	debug.sql(query.sql);
	
	/*
	
	Javascript is smart, so we don't have to do this:
	
	// Traverse all links and remove this object
	for(var i=0, link, attribute, parentList; i<list.__links.length; i++) {
		link = list.__links[i];
		attribute = link.attribute;
		parentList = link.list;
		
		delete parentList[attribute][keyValue];
		
	}
	
	*/
	
}


module.exports = DBO;


