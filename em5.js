var obj = {};
 
Object.defineProperty( obj, "value", {
  value: true,
  writable: false,
  enumerable: true,
  configurable: true
});
 
(function(){
  var name = "John";
 
  Object.defineProperty( obj, "name", {
    get: function(){ return name; },
    set: function(value){ name = value; 
		print("We set name to " + value);
	}
  });
})();
 
print( obj.value )
// true
 
print( obj.name );
// John
 
obj.name = "Ted";
print( obj.name );
// Ted
 
for ( var prop in obj ) {
  print( prop );
}
// value
// name
 
obj.value = false; // Exception if in strict mode
 
Object.defineProperty( obj, "value", {
  writable: true,
  configurable: false
});
 
obj.value = false;
print( obj.value );
// false
 
delete obj.value; // Exception


function print(v) {
	console.log(v);
}