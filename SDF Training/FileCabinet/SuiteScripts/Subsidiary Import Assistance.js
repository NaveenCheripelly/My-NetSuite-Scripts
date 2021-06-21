/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
/*
Name                : Subsidiary Import Assistance.js
Purpose             : custom UI assistance Script to mass create subsidiary records in netsuite.
Created On          : 02/15/2018.
Script Type         : Suitelet
Script Owner        : Naveen Cheripelly/Aswini Priyanka
*/
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/record', 'N/file', 'N/redirect', 'N/task', 'N/url', 'N/config'],
    function(serverWidget, email, runtime, record, file, redirect, task, url, config) {
        function onRequest(context) {
            var fileSave_JSON = '';
            try {
                if (context.request.method === 'GET') {
                    var form = serverWidget.createForm({
                        title: 'Subsidiary Import Assistance'
                    });
                    //Read from the global variable
                    var configRecObj = config.load({
                        type: config.Type.COMPANY_PREFERENCES
                    });
                    log.debug('configRecObj', JSON.stringify(configRecObj));
                    var scriptparamId = runtime.getCurrentScript().getParameter("custscript_subimporttool_folder");
                    if (!scriptparamId) {
                        //Create a new Folder
                        var objRecord = record.create({
                            type: record.Type.FOLDER,
                            isDynamic: true
                        });
                        objRecord.setValue({
                            fieldId: 'name',
                            value: 'SubsidiaryImport' + new Date().toISOString()
                        });
                        scriptparamId = objRecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        scriptparamId = parseInt(scriptparamId);
                        configRecObj.setText({
                            fieldId: "custscript_subimporttool_folder",
                            text: scriptparamId
                        });
                    }
                    log.debug('scriptparamId', scriptparamId);
                    var downloadTemp = context.request.parameters.isTemplateDownload;

                    var upload = context.request.parameters.isUpload;
                    var flag = context.request.parameters.testflag;
                    log.debug('flag', flag);
                    var subsidiary_rec = record.create({
                        type: record.Type.SUBSIDIARY,
                        isDynamic: true,
                    });
                    var recordObj = record.create({
                        type: 'customrecord_subsidiary_codes',
                        isDynamic: true,
                    });
                    var outputDomain = url.resolveDomain({
                        hostType: url.HostType.APPLICATION
                    });
                    log.debug('outputDomain', outputDomain);
                    var recordFields = subsidiary_rec.getFields();
                    var recordFieldIds = [];
                    var recordFieldLabels = [];
                    /////////////////Creation Of Field InternalIds////////////////
                    var JSONobj = '{"INTERNAL ID":"internalid","COMPANY CODE":"custrecord_companycode","NAME":"name","SUBSUBSIDIARY OF":"parent",';
                    for (var i = 0; i < recordFields.length; i++) {
                        var field = subsidiary_rec.getField(recordFields[i]);
                        if (field && field.label) {
                            recordFieldLabel = field.label;
                            recordFieldLabel = recordFieldLabel.replace(',', '');
                            recordFieldLabel = recordFieldLabel.toUpperCase();
                            recordFieldId = field.id;

                            if (recordFieldLabel != 'NAME' && recordFieldLabel != 'SUBSUBSIDIARY OF' && recordFieldLabel != 'EXTERNALID' && recordFieldLabel != 'INTERNAL ID' && recordFieldLabel != 'COMPANY CODE') {
                                if (i < recordFields.length - 1)
                                    JSONobj = JSONobj + JSON.stringify(recordFieldLabel) + ":" + JSON.stringify(recordFieldId) + ",";
                                // else
                                //JSONobj = JSONobj+JSON.stringify(recordFieldLabel)+":"+JSON.stringify(recordFieldId);
                                recordFieldIds.push(recordFieldId);
                                recordFieldLabels.push(recordFieldLabel);
                            }
                        }
                    }
                    JSONobj = JSONobj + '"ATTENTION":"attention","ADDRESSEE":"addressee","PHONE":"addrphone","ADDRESS 1":"addr1","ADDRESS 2":"addr2","CITY":"city","STATE":"substate","SUBCOUNTRY":"subcountry","ZIP":"zip","IS SHIP ADDR SAME AS SUB ADDR?":"shippingaddress_text","IS RETURN ADDR SAME AS SUB ADDR?":"returnaddress_text","ADD NEXUS?":"nexus"';
                    JSONobj = JSONobj + '}';
                    var fileObjInternalIds = file.create({
                        name: "Subsidiary Internal Ids",
                        fileType: file.Type.PLAINTEXT,
                        contents: JSONobj,
                        folder: scriptparamId
                    });
                    fileSave_JSON = fileObjInternalIds.save();

                    fileSave_JSON = parseInt(fileSave_JSON);
                    configRecObj.setText({
                        fieldId: "custscript_subsidiary_internalid_fileid",
                        text: fileSave_JSON
                    });
                    log.audit('fileSave_JSON', fileSave_JSON);

                    /////////////////////////////////////////////////////////////////////
                    var countryField = recordObj.getField('custrecord150');
                    var countryOptions = countryField.getSelectOptions();
                    var JSONString = '{';
                    for (var k = 0; k < countryOptions.length; k++) {
                        var id = countryOptions[k].value;
                        var text = countryOptions[k].text;
                        if (k == countryOptions.length - 1)
                            JSONString = JSONString + JSON.stringify(text) + ':' + JSON.stringify(id);
                        else
                            JSONString = JSONString + JSON.stringify(text) + ':' + JSON.stringify(id) + ',';
                    }
                    JSONString = JSONString + '}';
                    var stateIdJson = file.create({
                        name: "State internalIds",
                        fileType: file.Type.PLAINTEXT,
                        contents: JSONString,
                        folder: scriptparamId
                    });
                    var stateSave_JSON = stateIdJson.save();
                    stateSave_JSON = parseInt(stateSave_JSON);
                    configRecObj.setText({
                        fieldId: "custscript_state_internalid_fileid",
                        text: stateSave_JSON
                    });
                    configRecObj.save();
                    log.debug('StateCodes', stateSave_JSON);
                    var finalTemplate = "";
                    finalTemplate = finalTemplate + "INTERNAL ID,COMPANY CODE,NAME,SUBSUBSIDIARY OF,";
                    finalTemplate = finalTemplate + recordFieldLabels.toString();
                    finalTemplate = finalTemplate + ',ATTENTION,ADDRESSEE,PHONE,ADDRESS 1,ADDRESS 2,CITY,STATE,COUNTRY,ZIP,IS SHIP ADDR SAME AS SUB ADDR?,IS RETURN ADDR SAME AS SUB ADDR?,ADD NEXUS?';
                    log.debug('finalTemplate', finalTemplate);
                    var fileObj = file.create({
                        name: 'DefaultTemplate.csv',
                        fileType: file.Type.PLAINTEXT,
                        contents: finalTemplate,
                        folder: scriptparamId
                    });
                    var fileId = fileObj.save();
                    var fileloderObj = file.load({
                        id: fileId
                    });
                    var fileUrl = fileloderObj.url;
                    fileUrl = fileUrl + '&_xd=T'
                    log.debug('fileUrl', fileUrl);
                    form.addSubmitButton({
                        label: 'Upload Subsidiary'
                    });

                    if (flag != 1) {

                        //var Suitelet_url = "https://system.netsuite.com/core/media/media.nl?id="+fileId+"&c=TSTDRV1151650&h=33b0b9c910552cc7aaff&_xd=T&_xt=.csv"
                        var Suitelet_url = fileUrl;
                        log.debug('Suitelet_url', Suitelet_url);

                        var window_new_open = 'window.open(\'' + Suitelet_url + '\',\'_blank\', \'\')';
                        form.addButton({
                            id: '_downloadlink',
                            label: 'Download Template to Create/Update Subsidiary',
                            functionName: window_new_open
                        });

                        /* var window_new_open_update = 'window.open(\'' + Suitelet_url + '\',\'_blank\', \'\')';
                        form.addButton({
                            id: '_downloadlink_update',
                            label: 'Download Template to Update Subsidiary',
                            functionName: window_new_open_update
                        });
 */
                    } else if (flag == 1 && upload == 'T') {
                        var fileUploads = form.addField({
                            id: '_upload_file',
                            type: serverWidget.FieldType.FILE,
                            label: 'Select File To Upload',
                        });

                    }

                    if (flag != 1) {

                        var instructstring = '';
                        instructstring += '<html>';
                        instructstring += '<body>';
                        instructstring += '<div style="background-color:#FFFFFF;">';
                        instructstring += '<p>&nbsp;</p>';
                        //instructstring+= '<p>&nbsp;</p>';

                        instructstring += '<p>&nbsp;</p>';
                        instructstring += '<p>&nbsp;</p>';
                        instructstring += '<div style="background-color:#607799;border:4px;">';
                        instructstring += '<h1 style="font-size:150%;font-weight:600;color:#FFFFFF;margin-left:2px;">Please read the below instructions carefully!</h1><br/>';
                        instructstring += '</div>';
                        //instructstring+= '<p>&nbsp;</p>';
                        instructstring += '<div style="background-color:#E6E6FA;">';
                        instructstring += '<p>&nbsp;</p>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>1</b>. Download the sample CSV template by clicking on the "Download Template to Create/Update Subsidiary"</p><br/>';
                        //instructstring += '<p style="font-size:130%;margin-left: 4px;">2. Download the sample CSV template by clicking on the "Download Template to Update Subsidiary" button for updating existing subsidiaries.</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>2</b>. Please enter the data in the downloaded CSV file.</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>3</b>. Tool automatically indentifies whether to create/update subsidiary based on "Internal Id" & "Company Code".</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>4</b>. Ensure to give "true" or "false" for the checkbox fields and questions mentioned in the file.</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>5</b>. Please do not alter the first four columns of the sheet[Internal Id,Company Code,Name,Subsubsidiary of].</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>6</b>. Remove the columns which are not needed to create/update from the file.</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>7</b>. If the cell in csv is given empty, we consider to update the field value as empty.Please remove the column instead.</p><br/>';
                        instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>8</b>. Please use the CSV file with proper data and click on "Upload Subsidiary" Button to upload the CSV file into NetSuite.</p><br/>';
						instructstring += '<p style="font-size:130%;margin-left: 4px;"><b>9</b>. Worried about subsidiary hierarchy and entering in sequence in CSV? Dont Worry!! We had provided the tool with intelligence to auto sort the subsidiaries based on parent-child relationship.</p><br/>';
                        instructstring += '</div>';
                        instructstring += '<p>&nbsp;</p>';
                        instructstring += '<p>&nbsp;</p>';
                        instructstring += '</div>';
                        instructstring += '</body>';
                        instructstring += '</html>';
                        var defaultMessage = form.addField({
                            id: 'custpage_default_message',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Note:'
                        }).defaultValue = instructstring;
                    }
                    //defaultMessage.layoutType = serverWidget.FieldLayoutType.MIDROW;
                    context.response.writePage(form);



                } else {
                    var scriptparamId = runtime.getCurrentScript().getParameter("custscript_subimporttool_folder");
                    var isTemplateDownload = context.request.parameters.download;
                    var fileUploadData = context.request.files._upload_file;
                    if (fileUploadData) {
                        fileUploadData = fileUploadData.getContents();
                        log.debug('fileUploadData', fileUploadData);
                        //creating the file in filecabinet of the file that the operation is performed on
                        var date = new Date();
                        var currentdate = date.getDate();
                        var month = date.getMonth();
                        var year = date.getYear();

                        var hours = date.getHours();
                        var minutes = date.getMinutes();
                        var seconds = date.getSeconds();
                        var milliSec = date.getMilliseconds();
                        date = date.toString();
                        var fileName = 'SUB_' + currentdate + month + year + 'T' + hours + minutes + seconds + milliSec;
                        var fileObj = file.create({
                            name: fileName,
                            fileType: file.Type.CSV,
                            contents: fileUploadData,
                            folder: scriptparamId
                        });
                        var fileSave = fileObj.save();
                        log.debug('fileSave', fileSave);
                        log.debug('fileSave_JSON2', fileSave_JSON);
                        var delete_task = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_ns_mr_subsidiary_import',
                            deploymentId: 'customdeploy_subsidiary_import',
                            params: {
                                custscript_import_file_data: fileSave
                            }
                        });
                        var mrTaskId = delete_task.submit();
                        var form = serverWidget.createForm({
                            title: ' '
                        });
                        var uploadConfirmation = serverWidget.createForm({
                            title: 'Your Request has been received. Tool will import the subsidiaries shortly. ThankYou!'
                        });
                        context.response.writePage(uploadConfirmation);


                    } else {
                        redirect.toSuitelet({
                            scriptId: 'customscript_subsidiary_import_assist',
                            deploymentId: 'customdeploy1',
                            parameters: {
                                'isTemplateDownload': isTemplateDownload,
                                'isUpload': 'T',
                                'testflag': 1
                            }
                        })
                    }
                }

            } catch (e) {
                log.debug('error', e);
            }
        }
        return {
            onRequest: onRequest
        };
    });