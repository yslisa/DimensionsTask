/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = PsiTurk(uniqueId, adServerLoc);

// All pages to be loaded
var pages = [
	"instructions/instruct-1.html",
	"instructions/instruct-2.html",
	"instructions/instruct-3.html",
	"instructions/instruct-ready.html",
	"stage.html",
	"postquestionnaire.html"
];

psiTurk.preloadPages(pages);

var instructionPages = [ // add as a list as many pages as you like
	"instructions/instruct-1.html",
	"instructions/instruct-2.html",
	"instructions/instruct-3.html",
	"instructions/instruct-ready.html"
];


/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested 
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and 
* insert them into the document.
*
********************/

/********************
* STROOP TEST       *
********************/
var StroopExperiment = function() {

	var wordon, // time word is presented
	    listening = false;

	var points = 0;

	// Stimuli 
	var stims = [
			["111", "222", "233", "1"],
			["121", "132", "213", "1"],
			["122", "221", "333", "1"],
			["132", "131", "123", "1"],
			["123", "331", "222", "1"],
			["222", "111", "333", "1"],
			["213", "112", "313", "1"],
			["131", "222", "323", "1"],
			["333", "132", "223", "1"]
		];

	_.shuffle(stims);

	var next = function() {
		// end
		if (stims.length===0) {
			finish();
		}
		// fixation cross
		else {
			stim = stims.shift();
			show_shape("blank", "Fix", "blank");
			setTimeout(present_stimuli, 1000)
			
		}
	};

	// present 3 shapes
	var present_stimuli = function() {
		show_shape(stim[0], stim[1], stim[2]);
		wordon = new Date().getTime();
		listening = true;
		d3.select("#query").html('<br><p id="prompt">Type "1" for the first shape, "2" for the second, "3" for the third.</p>');
	}
	
	var response_handler = function(e) {
		if (!listening) return;

		var keyCode = e.keyCode,
			response;

		switch (keyCode) {
			case 49:
				// "1"
				response="1";
				break;
			case 50:
				// "2"
				response="2";
				break;
			case 51:
				// "3"
				response="3";
				break;
			default:
				response = "";
				break;
		}
		if (response.length>0) {
			listening = false;
			var hit = response == stim[3];           // whether the participant chose the correct dimension
			var rt = new Date().getTime() - wordon;  // reaction time
			var gained = 0;

			if (rt > 2000) {
				show_shape("blank", "Slow", "blank");
			}

			else {
				if (hit) {
					var rand = Math.random();
					// +1 with .75 probability
					if (rand < 0.75) {
						points+=1;
						gained = 1;
						show_shape("blank", "Win", "blank");
					}
					else {
						show_shape("blank", "Lose", "blank");
					}
				}
				else {
					var rand = Math.random();

					show_shape("blank", "Lose", "blank");
				}
			}

			psiTurk.recordTrialData({'phase':"TEST",
                                     'stimuli1':stim[0],
                                     'stimuli2':stim[1],
                                     'stimuli3':stim[2],
                                     'correct': stim[3],  // stimuli w/ correct feature
                                     'response':response, // user input
                                     'hit':hit,           // whether correct feature was chosen
                                     'outcome':gained,    // point earned
                                     'rt':rt}
                                   );

			setTimeout(next, 1000);
		}
	};

	var finish = function() {
	    $("body").unbind("keydown", response_handler); // Unbind keys
	    currentview = new Questionnaire();
	};
	
	var show_shape = function(shape1, shape2, shape3) {
		remove_shape();
		// display total points
		d3.select("#points")
			.append("div")
			.attr("id","total")
			.style("text-align","right")
			.text("Points: "+points)

		// three stimuli
		d3.select("#stim1")
			.attr("src","/static/images/"+shape1+".png")
		d3.select("#stim2")
			.attr("src","/static/images/"+shape2+".png")
		d3.select("#stim3")
			.attr("src","/static/images/"+shape3+".png")
	};

	var remove_shape = function() {
		d3.select("#total").remove();
		//d3.select("#win").remove();
	};

	
	// Load the stage.html snippet into the body of the page
	psiTurk.showPage('stage.html');

	// Register the response handler that is defined above to handle any
	// key down events.
	$("body").focus().keydown(response_handler); 

	// Start the test
	next();
};


/****************
* Questionnaire *
****************/

var Questionnaire = function() {

	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {

		psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'submit'});

		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);		
		});

	};

	prompt_resubmit = function() {
		replaceBody(error_message);
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		replaceBody("<h1>Trying to resubmit...</h1>");
		reprompt = setTimeout(prompt_resubmit, 10000);
		
		psiTurk.saveData({
			success: function() {
			    clearInterval(reprompt); 
                            psiTurk.computeBonus('compute_bonus', function(){finish()}); 
			}, 
			error: prompt_resubmit}
		);
	};

	// Load the questionnaire snippet 
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'begin'});
	
	$("#next").click(function () {
	    record_responses();
	    psiTurk.saveData({
            success: function(){
                psiTurk.computeBonus('compute_bonus', function() { 
                	psiTurk.completeHIT(); // when finished saving compute bonus, the quit
                }); 
            }, 
            error: prompt_resubmit});
	});
    
	
};

// Task object to keep track of the current phase
var currentview;

/*******************
 * Run Task
 ******************/
$(window).load( function(){
    psiTurk.doInstructions(
    	instructionPages, // a list of pages you want to display in sequence
    	function() { currentview = new StroopExperiment(); } // what you want to do when you are done with instructions
    );
});
