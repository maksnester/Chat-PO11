'use strict';
$(document).ready(function(){
    $('form', '#settings').on("submit", function() {
        alert("not implemented yet");
        return false;
    });
    $('form', '#profile').on("submit", function() {
        alert("not implemented yet");
        return false;
    });

   $('button.close').on("click", function(event) {
       console.log(event);
       alert("Delete files not implemented")
   });
});