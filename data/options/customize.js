

var customizeInit = function() {

    chrome.extension.onRequest.addListener(function(request) {
        if (request && request.command != "filters_updated")
            return;
        else if (!request) {
            return;
        }
        if ($("#txtFiltersAdvanced").prop("disabled") === false)
            return;
        BGcall("get_custom_filters_text", function(text) {
            $("#txtFiltersAdvanced").val(text);
        });
    });

    // Add a custom filter to the list
    function appendCustomFilter(filter) {
        var customFilterText = $("#txtFiltersAdvanced").val();
        $("#txtFiltersAdvanced").val(filter + "\n" + customFilterText);
        saveFilters();
        $(".addControls").slideUp();
    }

    // Convert a messy list of domains to ~domain1.com|~domain2.com format
    function toTildePipeFormat(domainList) {
        domainList = domainList.trim().replace(/[\ \,\;\|]+\~?/g, "|~");
        if (domainList && domainList[0] != "~")
            domainList = "~" + domainList;
        return domainList;
    }

    $("#txtBlacklist").focus(function() {
        // Find the blacklist entry in the user's filters, and put it
        // into the blacklist input.
        var customFilterText = $("#txtFiltersAdvanced").val();
        var match = customFilterText.match(/^\@\@\*\$document\,domain\=(\~.*)$/m);
        if (match && $(this).val() == "")
            $(this).val(match[1]);
    });

    // The add_filter functions
    $("#btnAddUserFilter").click(function() {
        var blockCss = $("#txtUserFilterCss").val().trim();
        var blockDomain = $("#txtUserFilterDomain").val().trim();

        if (blockDomain == '.*' || blockDomain == "*" || blockDomain == '')
            appendCustomFilter("##" + blockCss);
        else
            appendCustomFilter(blockDomain + "##" + blockCss);

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).attr("disabled", "disabled");
    });

    $("#btnAddExcludeFilter").click(function() {
        var excludeUrl = $("#txtUnblock").val().trim();

        //prevent regexes
        if (/^\/.*\/$/.test(excludeUrl))
            excludeUrl = excludeUrl + "*";

        appendCustomFilter('@@' + excludeUrl + '$document');

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).attr("disabled", "disabled");
    });

    $("#btnAddBlacklist").click(function() {
        var blacklist = toTildePipeFormat($("#txtBlacklist").val());

        var filters = $("#txtFiltersAdvanced").val().trim() + '\n';
        // Delete the first likely line
        filters = filters.replace(/^\@\@\*\$document,domain\=~.*\n/m, "").trim();
        $("#txtFiltersAdvanced").val(filters);
        // Add our line in its place, or if it was empty, remove the filter
        if (blacklist)
            appendCustomFilter("@@*$document,domain=" + blacklist);
        else
            saveFilters(); // just record the deletion
        $("#btnAddBlacklist").attr("disabled", "disabled");
    });

    $("#btnAddUrlBlock").click(function() {
        var blockUrl = $("#txtBlockUrl").val().trim();
        var blockDomain = $("#txtBlockUrlDomain").val().trim();
        if (blockDomain == '*')
            blockDomain = '';

        //prevent regexes
        if (/^\/.*\/$/.test(blockUrl))
            blockUrl = blockUrl + "*";

        if (blockDomain == '')
            appendCustomFilter(blockUrl);
        else
            appendCustomFilter(blockUrl + "$domain=" + blockDomain);

        $(this).closest(".entryTable").find("input[type='text']").val("");
        $(this).attr("disabled", "disabled");
    });

    // The validation functions
    $("#txtBlacklist").bind("input", function() {
        var blacklist = toTildePipeFormat($("#txtBlacklist").val());

        if (blacklist)
            blacklist = "@@*$document,domain=" + blacklist;

        BGcall("validateLine", blacklist, function(response) {
            if (response)
                $("#btnAddBlacklist").removeAttr("disabled");
            else
                $("#btnAddBlacklist").attr("disabled", "disabled");
        });
    });

    $("#divUrlBlock input[type='text']").bind("input", function() {
        var blockUrl = $("#txtBlockUrl").val().trim();
        var blockDomain = $("#txtBlockUrlDomain").val().trim();
        if (blockDomain == '*')
            blockDomain = '';
        if (blockDomain)
            blockDomain = '$domain=' + blockDomain;
        var ok = false;

        BGcall("validateLine", (blockUrl + blockDomain), function(response) {
            if (response)
                ok = true;
            BGcall("isSelectorFilter", (blockUrl), function(secondResponse) {
                if (secondResponse)
                    ok = false;

                $("#btnAddUrlBlock").attr("disabled", ok ? null : "disabled");
            });
        });
    });

    $("#divCssBlock input[type='text']").bind("input", function() {
        var blockCss = $("#txtUserFilterCss").val().trim();
        var blockDomain = $("#txtUserFilterDomain").val().trim();
        if (blockDomain == '*')
            blockDomain = '';
        var ok = false;
        BGcall("validateLine", (blockDomain + "##" + blockCss), function(response) {
            if (response)
                ok = true;
            $("#btnAddUserFilter").attr("disabled", ok ? null : "disabled");
        });
    });

    $("#divExcludeBlock input[type='text']").bind("input", function() {
        var unblockUrl = $("#txtUnblock").val().trim();
        var ok = false;
        BGcall("validateLine", ('@@' + unblockUrl + '$document'), function(response) {
            if (response)
                ok = true;

            BGcall("isSelectorFilter", unblockUrl, function(secondResponse) {
                if (!unblockUrl || secondResponse)
                    ok = false;

                $("#btnAddExcludeFilter").attr("disabled", ok ? null : "disabled");
            });
        });
    });

    // When one presses 'Enter', pretend it was a click on the 'add' button
    $(".entryTable input[type='text']").keypress(function(event) {
        var submitButton = $(this).closest(".entryTable").find("input[type='button']");
        if (event.keyCode === 13 && !submitButton.prop("disabled")) {
            event.preventDefault();
            submitButton.click();
        }
    });

    $("a.controlsLink").click(function(event) {
        try {
            event.preventDefault();
            var myControls = $(this).closest("div").find(".addControls");
            $(".addControls").not(myControls).slideUp();
            myControls.slideToggle();
        } catch(e) {
            dump(e);
        }
    });

    $("#btnEditAdvancedFilters").click(function() {
        $("#divAddNewFilter").slideUp();
        $(".addControls").slideUp();
        $("#txtFiltersAdvanced").removeAttr("disabled");
        $("#spanSaveButton").show();
        $("#btnEditAdvancedFilters").hide();
        $("#txtFiltersAdvanced").focus();
    });

    // Update custom filter count in the background.
    // Inputs: custom_filters_text:string - string representation of the custom filters
    // delimited by new line.
    function updateCustomFiltersCount(custom_filters_text) {
        var custom_filters_array = custom_filters_text.split("\n");
        var new_count = {};
        var temp_filter_tracker = [];
        for(var i = 0; i < custom_filters_array.length; i++) {
            var filter = custom_filters_array[i]
            //Check if filter is a duplicate and that it is a hiding filter.
            if(temp_filter_tracker.indexOf(filter) < 0 && filter.indexOf("##") > -1) {
                temp_filter_tracker.push(filter);
                var host = filter.split("##")[0];
                new_count[host] = (new_count[host] || 0) + 1;
            }
      }
      BGcall("updateCustomFilterCountMap", new_count);
    }

    function saveFilters() {
        var custom_filters_text = $("#txtFiltersAdvanced").val();
        BGcall("set_custom_filters_text", custom_filters_text);

        updateCustomFiltersCount(custom_filters_text);

        $("#divAddNewFilter").slideDown();
        $("#txtFiltersAdvanced").attr("disabled", "disabled");
        $("#spanSaveButton").hide();
        $("#btnEditAdvancedFilters").show();
        $("#btnCleanUp").show();
    }
    $("#btnSaveAdvancedFilters").click(saveFilters);

    BGcall("get_custom_filters_text", function(text) {
        $("#txtFiltersAdvanced").val(text);
    });


    $("#btnCleanUp").click(function() {
        //Don't save immediately, first allow them to review changes
        if ($("#btnEditAdvancedFilters").is(":visible"))
            $("#btnEditAdvancedFilters").click();

        BGcall("normalizeList", $("#txtFiltersAdvanced").val(), true, function(response) {
            var newFilters = response;
            newFilters = newFilters.replace(/(\n)+$/,'\n'); // Del trailing \n's
            $("#txtFiltersAdvanced").val(newFilters);
        });

    });
}
