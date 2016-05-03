(function () {
    "use strict";

    var db;
    var reminderMap;
    var reminderMapFlip;

    var Notification;

    $(document).ready(function () {
        initNotoficationVar();
        initModeRadioOnChange();

        initTimeTable();
        initConnectToDb();
        initReminderMaps();
        initTaskList();

        initButtonActions();
    });


    var initNotoficationVar = function () {
        Notification = window.Notification || window.mozNotification || window.webkitNotification;
    };

    var initModeRadioOnChange = function () {
        $("input:radio[name=mode]").change(initNotificationMode);
    };

    var initNotificationMode = function () {
        if (Notification === undefined) {
            dialogMsg("notification-not-supported");
            $("#alert").prop("checked", true);

        } else if ($("#notification").is(":checked") && Notification.permission !== "granted") {
            var overlay = dialogOverlayMsg("notification-awaiting-permission");
            Notification.requestPermission(function () {

                if (Notification.permission !== "granted") {
                    dialogMsg("notification-denied");
                    $("#alert").prop("checked", true);
                }

                overlay.dialog("close");
            });
        }
    };

    var initTimeTable = function () {
        $("#timetable").dataTable({
            "paging": false,
            "ordering": false,
            "info": false,
            "order": [[3, "desc"]],
            "bFilter": false,
            "oLanguage": {
                "sEmptyTable": "Brak zapisanych powiadomień"
            }
        });
    };

    var initConnectToDb = function () {
        var schema = {
            stores: [{
                name: "task",
                keyPath: "id",
                autoIncrement: true,
                indexes: [
                    {name: "id", type: "TEXT"},
                    {name: "title", type: "TEXT"},
                    {name: "description", type: "TEXT"},
                    {name: "starttime", type: "TEXT"},
                    {name: "remindertime", type: "TEXT"},
                    {name: "done", type: "TEXT"}
                ]
            }]
        };

        var options = {
            mechanisms: ["indexeddb"],  // as required, used html5 indexeddb
            size: 64 * 1024 // 64 kB
        };

        db = new ydn.db.Storage("tasks", schema, options);
        db.onReady(function (e) {
            if (e !== undefined) {
                dialogOverlayMsg("cannot-connect");
            }
        });
    };

    var initReminderMaps = function () {
        reminderMap = new Map();
        reminderMap.put("0", "dokładnie wtedy");
        reminderMap.put("5", "5 minut wcześniej");
        reminderMap.put("10", "10 minut wcześniej");
        reminderMap.put("15", "15 minut wcześniej");
        reminderMap.put("30", "30 minut wcześniej");
        reminderMap.put("45", "45 minut wcześniej");
        reminderMap.put("60", "1 godzinę wcześniej");
        reminderMap.put("120", "2 godziny wcześniej");
        reminderMap.put("240", "4 godzin wcześniej");
        reminderMap.put("360", "6 godzin wcześniej");
        reminderMap.put("480", "8 godzin wcześniej");
        reminderMap.put("720", "12 godzin wcześniej");
        reminderMap.put("1440", "1 dzień wcześniej");
        reminderMap.put("2880", "2 dni wcześniej");
        reminderMap.put("4320", "3 dni wcześniej");
        reminderMap.put("7200", "5 dni wcześniej");
        reminderMap.put("10080", "7 dni wcześniej");
        reminderMap.put("43200", "30 dni wcześniej");
        reminderMapFlip = reminderMap.flip();
    };

    var initTaskList = function (tasks) {
        $("#timetable").find("tbody").find("tr[id!=rowTemplate]").remove();

        if (tasks === undefined) {
            var dbvalues = db.values("task");

            dbvalues.done(function (tasks) {
                var n = tasks.length;
                for (var i = 0; i < n; i++) {
                    addTask(tasks[i]);
                }
            });

        } else {
            clearAllTImeouts();
            db.clear();

            var req;
            var n = tasks.length;
            for (var i = 0; i < n; i++) {
                req = db.put("task", tasks[i]);
            }
            initTaskList();
        }
    };

    var addTask = function (task) {
        var $clonnedTrRow = $("#rowTemplate").clone().removeAttr("id");

        if (task === undefined) {
            makeEditable($clonnedTrRow);

        } else {
            if (task.done === "1") {
                $clonnedTrRow.addClass("done");
            }

            $clonnedTrRow.find(".title").text(task.title);
            $clonnedTrRow.find(".description").text(task.description);
            $clonnedTrRow.find(".starttime").text(task.starttime);

            $clonnedTrRow.find(".remindertime").text(reminderMap.get(task.remindertime));

            setTaskTimeout(task);
        }

        initDelButton($clonnedTrRow);
        initDatetimePicker($clonnedTrRow);

        $clonnedTrRow.appendTo("#timetable tbody");

        initEditableSpans();
    };

    var clearAllTImeouts = function () {
        var id = window.setTimeout(function () {
        }, 0);

        while (id--) {
            window.clearTimeout(id);
        }
    };

    var setTaskTimeout = function (task) {
        var datestr = task.starttime;
        var remindertime = parseInt(task.remindertime) * 1000 * 60;

        var msTimeout = dateStrToTime(datestr) - remindertime - Date.now();

        if (msTimeout > 0) {
            window.setTimeout(function () {
                notify(task);
            }, msTimeout);
        }
    };

    var notify = function (task) {
        task.done = "1";
        db.put({name: "task", keyPath: "id"}, task);
        initTaskList();

        var notifyTitle = "Interaktywny terminarz";
        var notifyText = "Przypomnienie o zdarzeniu:\n\n";
        notifyText = notifyText.concat("Tytuł: " + task.title + "\n");
        notifyText = notifyText.concat("Opis: " + task.description + "\n");
        notifyText = notifyText.concat("Czas rozpoczęcia: " + task.starttime + "\n");
        notifyText = notifyText.concat("Kiedy przypomnieć: " + reminderMap.get(task.remindertime) + "\n");

        if (Notification !== undefined && $("#notification").is(":checked") && Notification.permission === "granted") {
            window.setTimeout(function () {
                new Notification(
                    notifyTitle, {
                        body: notifyText,
                        icon: "http://casar.com.au/images/info-icon.png"
                    }
                );
            }, 1000);

        } else {
            window.setTimeout(function () {
                window.alert(notifyTitle + "\n\n" + notifyText);
            }, 1000);
        }
    };

    var makeEditable = function ($trrow) {
        replaceSpanWithInput($trrow, "title");
        replaceSpanWithInput($trrow, "description");
        replaceSpanWithInput($trrow, "starttime");
        initDatetimePicker($trrow);
        replaceRemidertimeWithSelect($trrow);
    };

    var replaceSpanWithInput = function ($trrow, classname) {
        var $span = $trrow.find("." + classname);

        var $input = $("<input />", {
            "type": "text",
            class: classname,
            "value": $span.text()
        });

        $span.parent().append($input);
        $span.remove();
    };

    var replaceRemidertimeWithSelect = function ($trrow) {
        var $span = $trrow.find(".remindertime");
        var selected = $span.text();

        var $select = $("<select />", {
            class: "remindertime"
        });

        for (var i = 0; i++ < reminderMap.size; reminderMap.next()) {
            var $option = $("<option />", {
                class: "remindertime",
                value: reminderMap.key(),
                text: reminderMap.value()
            });

            if (selected === reminderMap.value()) {
                $option.attr("selected", "selected");
            }

            $option.appendTo($select);
        }

        $span.parent().append($select);
        $span.remove();

    };

    var initButtonActions = function () {
        $("#addButton").click(addButtonAction);
        $("#saveButton").click(saveButtonAction);
    };


    var addButtonAction = function () {
        addTask();
    };

    var saveButtonAction = function () {
        var anyError = false;
        var tasks = [];

        var $allTrRows = $("#timetable").find("tbody").find("tr[id!=rowTemplate]");


        $allTrRows.each(function () {
            var title = $(this).find(".title");
            var description = $(this).find(".description");
            var starttime = $(this).find(".starttime");
            var remindertime = $(this).find(".remindertime");
            var tdone = $(this).hasClass("done") ? "1" : "0";

            var task = {
                title: title.val() || title.text(),
                description: description.val() || description.text(),
                starttime: starttime.val() || starttime.text(),
                remindertime: remindertime.val() || reminderMapFlip.get(remindertime.text())[0],
                done: tdone
            };

            if (task.done === "0") {
                var remindertimems = parseInt(task.remindertime) * 1000 * 60;
                var isFuture = dateStrToTime(task.starttime) - Date.now() > 0;
                var isFuture2 = dateStrToTime(task.starttime) - remindertimems - Date.now() > 0;

                if (task.title === "" || task.description === "" || task.starttime === "" || !isFuture || !isFuture2) {
                    $(this).removeClass("ok");
                    $(this).addClass("error");
                    anyError = true;
                } else {
                    $(this).addClass("ok");
                    $(this).removeClass("error");
                }
            }

            tasks.push(task);
        });

        if (!anyError) {
            initTaskList(tasks);
            dialogMsg("success");
        } else {
            dialogMsg("error");
        }


    };

    var initEditableSpans = function () {
        $("span").dblclick(function () {
            var $tr = $(this).closest("tr");
            if (!$tr.hasClass("done")) {
                makeEditable($tr);
            }
        });
    };


    var initDelButton = function ($trrow) {
        initSelector($trrow, ".delButton").click(function () {
            $(this).closest("tr").remove();
        });
    };

    var initDatetimePicker = function ($trrow) {
        initSelector($trrow, "input.starttime").datetimepicker({
            format: "Y-m-d H:i",
            lang: "pl"
        });
    };

    var initSelector = function ($trrow, selectorstr) {
        if ($trrow !== undefined) {
            return $trrow.find(selectorstr);
        }
        else {
            return $(selectorstr);
        }
    };

    var dialogMsg = function (msgType) {
        $("#dialog-message-" + msgType).dialog({
            modal: true,
            width: 500,
            height: 300,
            buttons: [
                {
                    text: "OK",
                    click: function () {
                        $(this).dialog("close");
                    }
                }
            ]
        });
    };

    var dialogOverlayMsg = function (msgType) {
        return $("#dialog-message-" + msgType).dialog({
            modal: true,
            width: 500,
            height: 300,
            dialogClass: "no-close"
        });
    };

    var dateStrToTime = function (datestr) {
        try {
            return new Date(Date.parse(datestr).toISOString()).getTime();
        } catch (e) {
            return NaN;
        }
    };

})();
