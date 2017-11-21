# FACIFY - A Facebook Messanger Shopping Chat Bot built with Facial Emotional AI Capability
> This Bot is built as part of Facebook Developer Circle Toronto Hackathon 2017

## What makes us to come up with this idea ?....
We noticed the real difference in In-store shopping and Online Shopping is the personal touch and assistance which we get In-store.

* For Example,
    * If you are vising store for some shopping and if you dont't like anything and heading out from the store
    * At that time, store assistant will come to you, and will try to convince with other product and will ask you if you need any kind of help with purchase?
    * Think of this, why this happenned, who told the assistant that you are not liking anything and heading out with disappointment ?
    * The Answer is : Your FACE !!, Yes that is true they read your FACE and get to know that you are not currently happy with the items in the store
    * And by this, they will try to retain you as a customer and offer you/suggest you some items which you looking for or might be interested.

* So, the next question would be does it possible with Online shopping ?....
* The Answer is YES, With FACIFY it is possible to retain the customer based on their emotions while doing online shopping.

> Does it help and affects the purchase rate ?....
* Yes, Sure it will affect and in fact it will increase the average purchase rate and satisfaction with the brand by significant number.
* Lets, see some of the numbers/statastics which we did research for....
    * Usually any website has < 15 Seconds to get an attension
    * By this time website has to offer what he/she is looking for and need to see if there is a best match from catalogue?
    * Also, it is always hard to retain customers online and get them back on platform for further purchases
* So All of the above is answered by our bot (Atleast some of them for now, we are still trying to make it intelligent)

## Key Features of Facify Bot
* Below are the capabilities of the Bot as of its version 1.0

    * Bot will provide product catalogue from the configured store
    * Personalized shopping experience by reading live Emotions of the customer
    * Helps in finding right product
    * You can visualize you in your desired outfilt by Try Out feature of the Bot [This will super impose your face to your choosen outfit]
    * Suggest you some other products/accessories on based of your Emotions while trying out the outfit
    * After cheking out the product, it will take Live Feedback through your facial Emotions instead of asking you to filling out some feedback form
    * It will understand your language [Basic NLP support for this phase, bot needs to be learn and improved :P]

## Technology that gave Bot a BRAIN !....
> Below are the basic technology we have used
* Facebook Messenger Platform
* Shopify API
* Emotions API (Microsoft)
* Javscript/Jquery (ES6)
* NLP (Facebook in-built NLP)
* botmock.com [Please refer this link for complete flow of Facify] (https://botmock.com/mocks/748f6990-c70b-11e7-869a-ef0dd7da9283/export/7497d770-c70b-11e7-950e-5f27602d5836)


## Future Plan with Facify - Possibilities are endless - Here are the few ideas

* Integrating Emotional API so deeply with bot for better shopping experience and to give each customer a personalized touch
* FaciFy can learn customers interestes, life events and more from their Facebook Profile and feed and accordingly serve them correct product at correct time
    * For example, If its summer time, and if we can analyze that he/she is found of beach then we can gave suggestions for swim wear, and other relavent products
* Can access past events and photos from Facebook profile and analyze with Emotion API and suggestion to be made on base of that
* Want to improve bot for NLP (Natural Language Processing) to handle each kind of context from the user
* Want to add better shipping facilities and payment method throgh bot itself 


## Facify Presentation 
> Please find below link where you can take a look of `presentation` made for `Developer Circle Hackthon Toronto 2017`

https://prezi.com/view/DXlNnmS9BXyGwpFhKNTT/


## Found Interesting and Want to Contribute - Feel free and follow below steps to Get Started with this
Follow these steps to get our bot configured and off the ground.

> Must create a personal Facebook account and a Facebook developer account [here] (https://developers.facebook.com/) 

## Before you begin - Tasks

* Create a Facebook page [here] (https://www.facebook.com/pages/create) 
    * Choose Cause or Community as the page type
    * Use this format for the page name: ```Facify Team - Your Name```
    * Add a page username using the same format: ```Facify Team - Your Name```
    * Configure your page's button: Add Button > Get in Touch > Send Message 
    * Bookmark your page and/or Pin to Favorites so you can find it later
    * Ensure you and if anyone is going to use this are page admins
* Ensure to give us some credit and let us know if any help is needed 

## Server Configuration - Part I
> these steps have no dependencies so complete them first
* Update config/default.json 
    * "fb_validationToken": "make up a short phrase to use when you validate your webhook in a later step",
    * "sh_shopName": "select the value that is already there for now - You can change with any shopify store",
    * "sh_apiKey": "select the value that was assigned to Shopify store",
    * "sh_apiPassword": "select the value that was assigned to Shopify store",

## Configure your Facebook application - Part I
> The App Dashboard is the admin panel for all your Facebook Platform integrations. Every app you create contains some unique values which are used to secure the communication channels between your bot, the Messenger Platform and the people who message your page. You must copy these values into your bot's config file.
* Create a Facebook application in the [App Dashboard] (https://developers.facebook.com/apps)
    * Copy the App Secret value from the App Dashboard 
* Update config/default.json 
    * "fb_appSecret": "the auto generated value for your app in the App Dashboard"
* Add and configure the Messenger product
    * App Dashboard > {Your App} > Add Product > Messenger > Token Generation > Page > {select your page}
    * Copy the generated value
* Update config/default.json 
    * "fb_pageAccessToken":  "the value generated in and copied from the App Dashboard"

## Start your server and ngrok tunnel
> You must run your server so that the Messenger Platform can verify that your webhook is available 
* Run `npm install` from the project root folder to install all dependencies
* Run `ngrok http 5000` to get a public URL to your node server. DO NOT CLOSE THIS WINDOW!!!
* Update config/default.json 
    * "host_url": "https://{your unique url}.ngrok.io"
    * If you close/restart the ngrok service, update this field with the new URL and restart the node server.
* Run `npm start` to start the node server

## Configure your Facebook application - Part II

* Configure the Webhooks product
    * App Dashboard > {Your App} > Messenger > Webhooks > Setup Webhooks
        * Callback URL:  https://{your unique url}.ngrok.io/webhook
            * If you close/restart the ngrok service, repeat this step with the new URL.
        * Verify token: use the value you defined for the fb_validationToken field in config/default.json 
        * Subscription fields: select messages and messaging_postbacks as a minimum
    * App Dashboard > {Your App} > Messenger > Webhooks > Select a Page... > {select your page} > Subscribe

## Test your bot
* Open your Facebook page 
* Click the Send Message button and tap the Get Started button and Give bot any greetings
* Send a simple text message to your bot
> The message should be echoed back at you
* Send 'help' to your bot
> You should be presented with a message a button
* Tap the 'Get 5 products' button
> You should see a carousel with five cards, one for each product that was returned
* From there, it is all you and bot, Have a nice chit-chatting and Shopping.
