var config = require("./config/config.js");

var BME280 = require('node-adafruit-bme280');
var gpio = require("rpi-gpio");


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

    getSettings:function(config.deviceID){
        //---------------------------------------------------------------------------
        //TODO: write get request to web server so settings can be used to update state
        //---------------------------------------------------------------------------

    }

    initGPIO: function(){
        //this is for relay channel one (water pump)
        gpio.setup(11, gpio.DIR_HIGH);
        //this is for relay channel two (light on/off)
        gpio.setup(12, gpio.DIR_HIGH);
    },

    //close relay circuit for channel 11
    pumpOn: function(){
        gpio.write(11, false);
    },

    //open relay circuit for channel 11
    pumpOff: function(){
        gpio.write(11, true);
    },

    //close relay circuit for channel 12
    lightOn: function(){
        gpio.write(12, false);
    },

    //open relay circuit for channel 11
    lightOff: function(){
        gpio.write(12, true);
    }, 

};

//----------------------------------------------------------------
//-------Below Code for testing purposes only. -------------------
//----------------------------------------------------------------

app.initGPIO();
console.log("Running Test scripts for device "+ config.deviceID);

//turn each relay channel off/on every 10 seconds to demonstrate functionality:
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
