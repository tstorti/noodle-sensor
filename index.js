var config = require("./config/config.js");

//library for temp/humidity sensor
var BME280 = require('node-adafruit-bme280');

//library for read/write on gpio pins
var gpio = require("rpi-gpio");

//library for MCP3800
var mcpadc = require("mcp-spi-adc");


var app = {

    
    collectData: function(){
        BME280.probe(function(temperature, pressure, humidity) {
            //temperature in C
            console.log("Temperature: "+ temperature);
            //percentage humidity
            console.log("Current Humidity: "+ humidity);                
        
            //--------------------------------------------------------------------
            //TODO: write post request to web server so data can be recorded in db
            //-------------------------------------------------------------------- 
        
        });
    }, 

    getSettings:function(deviceID){
        //---------------------------------------------------------------------------
        //TODO: write get request to web server so settings can be used to update state
        //---------------------------------------------------------------------------

    },

    initGPIO: function(){
        //this is for relay channel one (water pump)
        gpio.setup(11, gpio.DIR_HIGH);
        //this is for relay channel two (light on/off)
        gpio.setup(12, gpio.DIR_HIGH);
    },

    //close relay circuit for channel 11
    pumpOn: function(){
        console.log("turning pump relay on");
        gpio.write(11, false);
    },

    //open relay circuit for channel 11
    pumpOff: function(){
		console.log("turning pump relay off");
        gpio.write(11, true);
    },

    //close relay circuit for channel 12
    lightOn: function(){
		console.log("turning light relay on");
        gpio.write(12, false);
    },

    //open relay circuit for channel 11
    lightOff: function(){
		console.log("turning light relay off");
        gpio.write(12, true);
    }, 

};

//----------------------------------------------------------------
//-------Below Code for testing purposes only. -------------------
//----------------------------------------------------------------

//app.initGPIO();
console.log("Running Test scripts for device "+ config.settings.deviceID);


//turn each relay channel off/on every 10 seconds to demonstrate relay functionality:
var state = "off";
var count = 0;

var interval1 = setInterval(function(){

    if (state ==="off"){
        app.lightOn();
        app.pumpOn();
        state = "on";
    }
    else{
        app.lightOff();
        app.pumpOff();
        state="off";
    }

    count++;
    //stop cycling after 5 iterations
    if (count > 5){
        clearInterval(interval1);
    }

},10000);

//demonstrate BME280 is working by logging temp and humidity every 5 seconds.
var interval2 = setInterval(function(){
    
    app.collectData();

},5000);


//demonstrate MCP3008 is working by logging input voltages from photoresitor
//connected to channel 1 of 8 on MCP3008
var lightSensor = mcpadc.open(0,{speed:20000},function(err){
	if (err) throw err;

	var interval3 = setInterval(function(){
		lightSensor.read(function(err, reading){
			if (err) throw err;
			
			//reading.value returns a number between 0 and 1.  The lower the value, the brighter the light source
			console.log("photoresistor reading: "+ reading.value);
		});

	},5000);
});


//soil moisture reading - connected to channel #2 of 8 on mcp3008 using analog out
var soilMoistureSensor = mcpadc.open(1,{speed:20000},function(err){
	if (err) throw err;

	var interval4 = setInterval(function(){
		soilMoistureSensor.read(function(err, reading){
			if (err) throw err;
			
			//reading returns a number between 0 and 1.  
			//if totally dry conditions, returns 1.  Sensor submerged in water returns ~0.5
			console.log("soil moisture reading: "+ reading.value);
		});

	},5000);
});
