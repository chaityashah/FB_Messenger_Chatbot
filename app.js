/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request'),
  Shopify = require('shopify-api-node'),
  Jimp = require('jimp');
  //$ = require('jquery'),
  //webcam = require('./public/webcam');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

/*
 * Open config/default.json and set your config values before running this code. 
 * You can also set them using environment variables.
 *
 */

// App Secret can be retrieved from the App Dashboard
const FB_APP_SECRET = (process.env.FB_APP_SECRET) ? 
  process.env.FB_APP_SECRET :
  config.get('fb_appSecret');

// Arbitrary value used to validate a webhook
const FB_VALIDATION_TOKEN = (process.env.FB_VALIDATION_TOKEN) ?
  (process.env.FB_VALIDATION_TOKEN) :
  config.get('fb_validationToken');

// Generate a page access token for your page from the App Dashboard
const FB_PAGE_ACCESS_TOKEN = (process.env.FB_PAGE_ACCESS_TOKEN) ?
  (process.env.FB_PAGE_ACCESS_TOKEN) :
  config.get('fb_pageAccessToken');

const SHOPIFY_SHOP_NAME = (process.env.SHOP_NAME) ? 
  process.env.SHOP_NAME :
  config.get('sh_shopName');  

const SHOPIFY_API_KEY = (process.env.SHOP_API_KEY) ? 
  process.env.SHOP_API_KEY :
  config.get('sh_apiKey');  

const SHOPIFY_API_PASSWORD = (process.env.SHOP_API_PASSWORD) ? 
  process.env.SHOP_API_PASSWORD :
  config.get('sh_apiPassword');  

const HOST_URL = (process.env.HOST_URL) ? 
  process.env.HOST_URL :
  config.get('host_url');  

// make sure that everything has been properly configured
if (!(FB_APP_SECRET && FB_VALIDATION_TOKEN && FB_PAGE_ACCESS_TOKEN && SHOPIFY_SHOP_NAME && SHOPIFY_API_KEY && SHOPIFY_API_PASSWORD && HOST_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

const shopify = new Shopify({
  shopName: SHOPIFY_SHOP_NAME,
  apiKey: SHOPIFY_API_KEY,
  password: SHOPIFY_API_PASSWORD
});

let imageCount = 0;
let productId = 0;
let productImg = '';


/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * your App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // In DEV, log an error. In PROD, throw an error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    //console.log("signatureHash: " + signatureHash);
    //console.log("expectedHash: " + expectedHash);

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === FB_VALIDATION_TOKEN) {
    console.log("[app.get] Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

/**
 * serves a static page for the webview
 */ 
app.get('/product_description', function(req, res) {
  var product_id = req.query['id'];
  if (product_id !== 'null') {
    console.log("[app.get] product id:" + product_id);
    var sh_product = shopify.product.get(product_id);
    sh_product.then(function(product) {
      console.log("<<<<<<<<<<<<<product>>>>>>>>>>>"+JSON.stringify(product));
      console.log(product.options[0].values);
      res.status(200).send(product.body_html);
    }, function(error) {
      console.error("Error retrieving product");
      res.sendStatus(400).send("Error retrieving product");
    });
    
  } else {
    console.error("Product id is required");
    res.sendStatus(400).send("Product id is required");          
  }  
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  // You must send back a status 200 to let the Messenger Platform know that you've
  // received the callback. Do that right away because the countdown doesn't stop when 
  // you're paused on a breakpoint! Otherwise, the request might time out. 
  res.sendStatus(200);
        
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // entries may be batched so iterate over each one
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {

        let propertyNames = [];
        for (var prop in messagingEvent) { propertyNames.push(prop)}
        console.log("[app.post] Webhook received a messagingEvent with properties: ", propertyNames.join());
        
        if (messagingEvent.message) {
          // someone sent a message
          receivedMessage(messagingEvent);

        } else if (messagingEvent.delivery) {
          // messenger platform sent a delivery confirmation
          receivedDeliveryConfirmation(messagingEvent);

        } else if (messagingEvent.postback) {
          // user replied by tapping one of our postback buttons
          receivedPostback(messagingEvent);

        } else {
          console.log("[app.post] Webhook is not prepared to handle this message.");

        }
      });
    });
  }
});

function firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}
/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var pageID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("[receivedMessage] user (%d) page (%d) timestamp (%d) and message (%s)", 
    senderID, pageID, timeOfMessage, JSON.stringify(message));

  if (message.quick_reply) {
    console.log("[receivedMessage] quick_reply.payload (%s)", 
      message.quick_reply.payload);
    handleQuickReplyResponse(event);
    return;
  }

  var greeting = firstEntity(message.nlp, 'greetings');
  if (greeting && greeting.confidence > 0.8) {

    request({
      uri: 'https://graph.facebook.com/v2.6/'+senderID,
      qs: {fields:'first_name',  access_token: FB_PAGE_ACCESS_TOKEN },
      method: 'GET',
      //json: messageData

    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("response>>"+JSON.stringify(response));
        var body = {};
        body = JSON.parse(response.body);
        var firstName = body["first_name"];
        sendTextMessage(senderID, 'Hi '+firstName);
        setTimeout(function(){ sendTextMessage(senderID, 'Would you like to try something on?'); }, 2000);
        
        var recipientId = body.recipient_id;
        var messageId = body.message_id;

        if (messageId) {
          console.log("[callSendAPI] Successfully sent message with id %s to recipient %s", 
            messageId, recipientId);
        } else {
        console.log("[callSendAPI] Successfully called Send API for recipient %s", 
          recipientId);
        }
      } else {
        console.error("[callSendAPI] Send API call failed", response.statusCode, response.statusMessage, body.error);
      }
    });  

    //const name = JSON.parse( request('https://graph.facebook.com/v2.6/${senderID}?fields=first_name&access_token=${FB_PAGE_ACCESS_TOKEN}'));
    
    return;
  }
  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    var lcm = messageText.toLowerCase();
    switch (lcm) {
      // if the text matches any special keywords, handle them accordingly
      case 'help':
         
        sendHelpOptionsAsButtonTemplates(senderID);
        break;
      case 'generic':
         
        sendHelpOptionsAsButtonTemplates(senderID);
        break;
      case 'yes':
        sendTextMessage(senderID, '💃🏼');
         
        sendTextMessage(senderID, 'Here are a few options');
        //sendHelpOptionsAsButtonTemplates(senderID);
        var payload = JSON.stringify({action: 'QR_GET_PRODUCT_LIST', limit: 5});
        respondToHelpRequestWithTemplates(senderID, payload);
        //const shopifyData =  callShopifyApi();
         
        // sendGenericMessage(senderID, shopifyData);
        break;
      case 'no':
         
        sendTextMessage(senderID, '😭');
         
        sendTextMessage(senderID, 'Okay, goodbye!');
         
        sendTextMessage(senderID, '👻');
        break;
      case 'bye':
        sendTextMessage(senderID, 'BYE');
         
        sendTextMessage(senderID, '👻');
        break;

      case 'something':

      break;

      default:
        //  sendGenericMessage(senderID).catch(e => { return; } );
        //const name = JSON.parse( request('https://graph.facebook.com/v2.6/${senderID}?fields=first_name&access_token=${FB_PAGE_ACCESS_TOKEN}'));
        //sendTextMessage(senderID, 'Hi ${name.first_name}');
        //sendTextMessage(senderID, 'Would you like to try something on?');
      //default:
        // otherwise, just echo it back to the sender
        //sendTextMessage(senderID, messageText);
         
        sendTextMessage(senderID, 'This sounds something new to me, can you please elobarate?');
    }
  } else if (messageAttachments) {
     
    sendTextMessage(senderID, '🔥');
     
    mergeImages(senderID, messageAttachments[0].payload.url);
    //sendGeneratedImage(senderID, messageAttachments);
  }
}

function mergeImages(senderID, messageAttachments) {
  Jimp.read(messageAttachments).then(function (image_face) {
      Jimp.read(productImg, function (err, image_costume) {
        const resizedBase = image_costume.resize(800, Jimp.AUTO);
        const resizedFace = image_face.resize(160, Jimp.AUTO);
        const xPosition = 340;
        const yPosition = 10;//resizedBase.bitmap.width;
        const newImage = resizedBase.composite(resizedFace, xPosition, yPosition);
        const imageName = 'image-'+imageCount+'.jpg';
        newImage.write('public/images/'+imageName, function(error, result) {
          imageCount ++;
          const remixedUrl = 'http://65f5fd2f.ngrok.io/images/'+imageName;
          sendImageMessage(senderID, remixedUrl);
        });
      });
  }).catch(function (err) {
      // handle an exception 
  });
}

function sendGeneratedImage(senderID, messageAttachments) {
  const base = userSelectedImage;
  const face = messageAttachments[0].payload.url; 
  userUploadedFace = face;
  const remixed = imageMixer(base, face);
  const remixedUrl = 'http://65f5fd2f.ngrok.io/images/${remixed}';
  sendImageMessage(senderID, remixedUrl);
}
/*
function addDelay(recipientId, withTyping = true, duration = 500) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      sender_action: "typing_on",
    };
    if (withTyping) {
       callSendAPI(messageData)
    }
*/
setTimeout(function(){ withTyping?  callSendAPI(messageData) : null; }, duration);


/*
 * Send a message with buttons.
 *
 */
function sendHelpOptionsAsButtonTemplates(recipientId) {
  console.log("[sendHelpOptionsAsButtonTemplates] Sending the help options menu"); 
  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment:{
        type:"template",
        payload:{
          template_type:"button",
          text:"Click the button before to get a list of 5 of our products.",
          buttons:[
            {
              "type":"postback",
              "title":"Get 5 products",
              "payload":JSON.stringify({action: 'QR_GET_PRODUCT_LIST', limit: 5})
            }
            // limit of three buttons 
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Someone tapped one of the Quick Reply buttons so 
 * respond with the appropriate content
 *
 */
function handleQuickReplyResponse(event) {
  var senderID = event.sender.id;
  var pageID = event.recipient.id;
  var message = event.message;
  var quickReplyPayload = message.quick_reply.payload;
  
  console.log("[handleQuickReplyResponse] Handling quick reply response (%s) from sender (%d) to page (%d) with message (%s)", 
    quickReplyPayload, senderID, pageID, JSON.stringify(message));
  
  // use branched conversation with one interaction per feature (each of which contains a variable number of content pieces)
  respondToHelpRequestWithTemplates(senderID, quickReplyPayload);
  
}

/*
 * This response uses templateElements to present the user with a carousel
 * You send ALL of the content for the selected feature and they can 
 * swipe from side to side to see it
 *
 */
function respondToHelpRequestWithTemplates(recipientId, requestForHelpOnFeature) {
  console.log("[respondToHelpRequestWithTemplates] handling help request for %s",
    requestForHelpOnFeature);
  var templateElements = [];

  var requestPayload = JSON.parse(requestForHelpOnFeature);

  var sectionButton = function(title, action, options) {
    var payload = options | {};
    payload = Object.assign(options, {action: action});
    return {
      type: 'postback',
      title: title,
      payload: JSON.stringify(payload)
    };
  }

  var textButton = function(title, action, options) {
    var payload = options | {};
    payload = Object.assign(options, {action: action});
    return {
      "content_type":"text",
      title: title,
      payload: JSON.stringify(payload)
    };
  }
  console.log("<<<<<<<<<<<requestPayload.action>>>>>>>>>>>>>"+requestPayload.action);
  switch (requestPayload.action) {
    case 'QR_GET_PRODUCT_LIST':
      var products = shopify.product.list({ limit: requestPayload.limit});
      products.then(function(listOfProducs) {
        listOfProducs.forEach(function(product) {
          var url = HOST_URL + "/product.html?id="+product.id;
          templateElements.push({
            title: product.title,
            subtitle: product.tags,
            image_url: product.image.src,
            buttons:[
              {
                "type":"web_url",
                "url": url,
                "title":"Read description",
                "webview_height_ratio": "full",
                "messenger_extensions": "true"
              },
              sectionButton('Try On', 'QR_TRY_PRODUCT', {id: product.id, img:product.image.src})
            ]
          });
        });

        
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: templateElements
              }
            }
          }
        };

        callSendAPI(messageData);

      });

      break;

    case 'QR_GET_PRODUCT_OPTIONS':
      var sh_product = shopify.product.get(requestPayload.id);
      sh_product.then(function(product) {
        var options = '';
        product.options.map(function(option) {
          options = options + option.name + ': ' + option.values.join(',') + "\n";
        });
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            //text: options.substring(0, 640),
            text: 'Please Choose your Size',
            quick_replies: [
              textButton('Size S', 'QR_CHOOSE_OPTION', {size:'S'}),
              textButton('Size M', 'QR_CHOOSE_OPTION', {size:'M'}),
              textButton('Size L', 'QR_CHOOSE_OPTION', {size:'L'})
            ]
          },
        };
        callSendAPI(messageData);
      });



      break;

      case 'QR_CHOOSE_OPTION':
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: 'Nice !!! You selected size -> '+requestPayload.size+ ' Are you sure you want to buy this item? Click Buy now!',
            quick_replies: [
              textButton('Buy now!', 'QR_BUY_NOW', {})
            ]
          },
        };
        callSendAPI(messageData);

      break;

      case 'QR_TRY_PRODUCT':
        console.log("QR_TRY_PRODUCT>>>>>"+requestPayload.id);
        productId = requestPayload.id;
        productImg = requestPayload.img;
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: 'Please upload your photo.'
          },
        };
        callSendAPI(messageData);
      break;

      case 'QR_BUY_NOW':
        var url = HOST_URL + "/feedback.html";
        messageData = {
          recipient: {
            id: recipientId
          },
           message:{
            attachment:{
              type:"template",
              payload:{
                template_type:"button",
                text:"Thank you for your purchase. Please click on Feedback button",
                buttons:[
                  {
                    "type":"web_url",
                    "url": url,
                    "title":"Live Feedback",
                    "webview_height_ratio": "compact",
                    "messenger_extensions": "true"
                  }
                  // limit of three buttons 
                ]
              }
            }
          }
        }

        callSendAPI(messageData);

      break;
  }

}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id; // the user who sent the message
  var recipientID = event.recipient.id; // the page they sent it from
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("[receivedDeliveryConfirmation] Message with ID %s was delivered", 
        messageID);
    });
  }

  console.log("[receivedDeliveryConfirmation] All messages before timestamp %d were delivered.", watermark);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("[receivedPostback] from user (%d) on page (%d) with payload ('%s') " + 
    "at (%d)", senderID, recipientID, payload, timeOfPostback);

  respondToHelpRequestWithTemplates(senderID, payload);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText, // utf-8, 640-character max
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: FB_PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("[callSendAPI] Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("[callSendAPI] Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("[callSendAPI] Send API call failed", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

/*
 * Send profile info. This will setup the bot with a greeting and a Get Started button
 */
function callSendProfile() {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: FB_PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: {
      "greeting":[
          {
          "locale":"default",
          "text":`Hi I am chat-bot. Here to change your online shopping experience. To get started, call me with greeting.`
          }
      ] ,
      "get_started": {
        "payload": JSON.stringify({action: 'something', limit: 0})
      },
      "whitelisted_domains":[
        HOST_URL
      ]
    }

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("[callSendProfile]: ", body);
      var result = body.result;
      if (result === 'success') {
        console.log("[callSendProfile] Successfully sent profile.");
      } else {
        console.error("[callSendProfile] There was an error sending profile.");
      }
    } else {
      console.error("[callSendProfile] Send profile call failed", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

function sendImageMessage(recipientId, url) {
  console.log(recipientId, url);
  console.log("productId>>>"+productId);
  var options = {
    action: 'QR_GET_PRODUCT_OPTIONS',
    id:productId
  };
  console.log("<<<<<<<options>>>>>>>>"+JSON.stringify(options));

  var messageData = {
    recipient: {
      id: recipientId
    },
    "message":{
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements":[
             {
              "title":"Outfit simulator",
              "image_url":url,
              "default_action": {
                "type": "web_url",
                "url": url,
              },
              buttons: [
                {
                type: "postback",
                title: "Get options!",
                payload: JSON.stringify(options),
                }
               ],                  
            }
          ],
        }
      }
    }
   
  };
  // console.log(messageData);
  callSendAPI(messageData);
}

/*
 * Start server
 * Webhooks must be available via SSL with a certificate signed by a valid 
 * certificate authority.
 */
app.listen(app.get('port'), function() {
  console.log('[app.listen] Node app is running on port', app.get('port'));
  callSendProfile();
});

module.exports = app;

