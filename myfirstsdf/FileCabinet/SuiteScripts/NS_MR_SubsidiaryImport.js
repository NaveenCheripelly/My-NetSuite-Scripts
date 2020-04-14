/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */
/*
Name                : Netsuite Subsidiary Assistance.js
Purpose             : Script to mass create subsidiary records in netsuite.
Created On          : 02/15/2018.
Script Type         : Map Reduce 
Script Owner        : Naveen Cheripelly/Aswini Priyanka
*/
/***************************************
Script Type     : Map/Reduce
Purpose         : Mass create subsidiary records from a file triggered from Netsuite Subsidiary assistance.
***************************************/
define(['N/file', 'N/runtime', 'N/record', 'N/log', 'N/search', 'N/error', 'N/email'],
    function(file, runtime, record, log, search, error, email) {
        function getInputData() {
            try {

                var scriptObj = runtime.getCurrentScript();
                var newFileData = scriptObj.getParameter({
                    name: 'custscript_import_file_data'
                });
                if (newFileData && newFileData != null) {
                    fileLoadId = newFileData;
                    var contents = file.load({
                        id: fileLoadId
                    }).getContents();
                    var csvArrayReceived = CSVToArray(contents);
                    csvArrayReceived = csvArrayReceived.slice(0, -1);
                    return csvArrayReceived;
                }
            } catch (err) {
                log.debug('Error in getting input data', err);
            }
        }

        var fieldInternalId = [];
        var stateInternalId = [];
        var parentArray = [];
        var currencyArray = [];

        var subsidiarySearchResult = [];
        var errorDetailsArray = [];
        var errorCSVDataHeader = '';
        var errorFlag = false;

        function map(context) {
            try {

                log.debug('context', context);
                var scriptErrorparamId = runtime.getCurrentScript().getParameter("custscript_subimporttool_folder");
                var scriptAdminparamId = runtime.getCurrentScript().getParameter("custscript_system_admin");
                var scriptsubsidiaryparamId = runtime.getCurrentScript().getParameter("custscript_subsidiary_internalid_fileid");
                var scriptstateparamId = runtime.getCurrentScript().getParameter("custscript_state_internalid_fileid");

                var errorCSVDetail = '';
                if (context.key == 0) {

                    var subsidiaryInternal = file.load({
                        id: scriptsubsidiaryparamId
                    });
                    log.audit('subsidiaryInternal', subsidiaryInternal);
                    var subsidiaryKey = JSON.parse(subsidiaryInternal.getContents());
                    var headerData = JSON.parse(context.value);
                    errorCSVDataHeader = errorCSVDataHeader + ' ERROR,';
                    for (i = 0; headerData && i < headerData.length; i++) {
                        var headerLabel = headerData[i];
                        if (i < headerData.length - 1)
                            errorCSVDataHeader = errorCSVDataHeader + headerLabel + ",";
                        else
                            errorCSVDataHeader = errorCSVDataHeader + headerLabel + "\n";
                        fieldInternalId.push(subsidiaryKey[headerLabel]);
                    }
                    var stateInternalKey = file.load({
                        id: scriptstateparamId
                    });

                    var stateKey = JSON.parse(stateInternalKey.getContents());
                    stateInternalId = stateKey;
                    var subsidiarySearch = search.load({
                        id: 'customsearchparent_subsidiary_search'
                    });

                    var searchSubsidiaryResults = subsidiarySearch.run();
                    var companyCodeSearch = searchSubsidiaryResults.getRange({
                        start: 0,
                        end: 1000
                    });
                    if (companyCodeSearch.length > 0) {
                        var parentObj = [];
                        for (i = 0; i < companyCodeSearch.length; i++) {
                            var parent = {};
                            parent["id"] = companyCodeSearch[i].id;
                            parent["name"] = companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]);
                            parentObj.push(parent);
                        }
                    }
                    parentArray = parentObj;
                    var currencyCodeSearchResults = search.create({
                        type: "currency",
                        filters: [],
                        columns: [
                            search.createColumn({
                                name: "name",
                                label: "name"
                            })
                        ]
                    }).run();
                    var currenciesCodeSearch = currencyCodeSearchResults.getRange({
                        start: 0,
                        end: 1000
                    });

                    if (currenciesCodeSearch.length > 0) {
                        for (i = 0; i < currenciesCodeSearch.length; i++) {

                            var currency = {};
                            currency["id"] = currenciesCodeSearch[i].id;
                            currency["name"] = currenciesCodeSearch[i].getValue(currenciesCodeSearch[i].columns[0]);
                            currencyArray.push(currency);
                        }
                    }
                } else {

                    var headerData = JSON.parse(context.value);
                    var subsidiaryRec = '';
                    var subrec = '';
                    var enteredSubrec = false;
                    var shortname = '';
                    var isCreate = false;
                    var subAddrDetails = [];
                    var subAddrInternalId = [];
                    var isShipAddrSame = '';
                    var isReturnAddrSame = '';

                    for (var n = 0; headerData && n < headerData.length; n++) {
                        if (fieldInternalId[n] == 'custrecord_companycode' || fieldInternalId[n] == 'internalid') {
                            var filtersArray = [];
                            var isSearch = false;
                            log.audit(fieldInternalId[n], headerData[n]);
                            if (fieldInternalId[n] == 'internalid' && headerData[n] != '' && headerData[n] != null && headerData[n] != undefined) {
                                isSearch = true;
                                filtersArray.push(["internalid", "is", headerData[n]]);
                            } else if (headerData[n] == '' && fieldInternalId[n + 1] == 'custrecord_companycode' && headerData[n + 1] != '' && headerData[n + 1] != null && headerData[n + 1] != undefined) {
                                isSearch = true;
                                filtersArray.push(["custrecord_companycode", "is", headerData[n + 1]]);
                            }
                            if (isSearch == true) {
                                var searchforexistingSub = search.create({
                                    type: "subsidiary",
                                    filters: filtersArray
                                });
                                var searchforexistingSubOj = searchforexistingSub.run();
                                var isCompCodeFound = searchforexistingSubOj.getRange({
                                    start: 0,
                                    end: 1
                                });
                            }
                            if (isCompCodeFound && isCompCodeFound.length > 0) {
                                subsidiaryRec = record.load({
                                    type: record.Type.SUBSIDIARY,
                                    id: isCompCodeFound[0].id,
                                    isDynamic: true
                                });

                            } else {
                                subsidiaryRec = record.create({
                                    type: record.Type.SUBSIDIARY,
									
                                });
                                isCreate = true;
                            }
                        }
                        break;
                    }
                    for (var n = 0; n < headerData.length; n++) {
                        ////////////////////////Updating the Subsidiary if already exists///
                        if (fieldInternalId[n] == 'state' && enteredSubrec == false) {

                            var stateName = stateInternalId[headerData[n]];
                            if (stateName == "" || null == stateName) {
                                subsidiaryRec.setValue(fieldInternalId[n], headerData[n]);
                            } else {
                                var stateRecord = record.load({
                                    type: 'state',
                                    id: stateName,
                                    isDynamic: true,
                                });
                                shortname = stateRecord.getValue('shortname');
                                subsidiaryRec.setValue(fieldInternalId[n], shortname);
                            }
                        } else if (fieldInternalId[n] == 'parent') {
                            var parentInternalId = '';
                            for (j = 0; j < parentArray.length; j++) {
                                if (parentArray[j].name == headerData[n]) {
                                    parentInternalId = parentArray[j].id
                                }
                            }
                            if (!isNotNull(parentInternalId)) {
                                var subsidiarySearch = search.load({
                                    id: 'customsearchparent_subsidiary_search'
                                });
                                var searchSubsidiaryResults = subsidiarySearch.run();
                                var companyCodeSearch = searchSubsidiaryResults.getRange({
                                    start: 0,
                                    end: 1000
                                });
                                var internalId = '';

                                if (companyCodeSearch.length > 0) {
                                    for (i = 0; i < companyCodeSearch.length; i++) {
                                        if (companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]) == headerData[n]) {
                                            var parent = {};
                                            internalId = companyCodeSearch[i].id;
                                            parent["id"] = companyCodeSearch[i].id;
                                            parent["name"] = companyCodeSearch[i].getValue(companyCodeSearch[i].columns[0]);
                                            parentArray.push(parent);
                                        }
                                    }
                                }
                                subsidiaryRec.setValue(fieldInternalId[n], internalId);
                            } else {
                                subsidiaryRec.setValue(fieldInternalId[n], parentInternalId);
                            }
                        } else if (fieldInternalId[n] == 'addressee' || fieldInternalId[n] == 'addr1' || fieldInternalId[n] == 'addr2' || fieldInternalId[n] == 'city' || fieldInternalId[n] == 'addrphone' || fieldInternalId[n] == 'zip' || fieldInternalId[n] == 'subcountry' || (fieldInternalId[n] == 'substate' && enteredSubrec == true)) {
                            if (fieldInternalId[n] == 'addressee') {
                                enteredSubrec = true;
                                subrec = subsidiaryRec.getSubrecord({
                                    fieldId: 'mainaddress'
                                });
                                subrec.setValue(fieldInternalId[n], headerData[n]);
                                subAddrDetails[fieldInternalId[n]] = headerData[n];
                                subAddrInternalId.push(fieldInternalId[n]);
                            } else if (fieldInternalId[n] == 'substate' && enteredSubrec == true) {
								
								////////
							var stateName = stateInternalId[headerData[n]];
                            if (stateName == "" || null == stateName) {
                                subsidiaryRec.setValue(fieldInternalId[n], headerData[n]);
                            } else {
                                var stateRecord = record.load({
                                    type: 'state',
                                    id: stateName,
                                    isDynamic: true,
                                });
                                shortname = stateRecord.getValue('shortname');
                                subrec.setValue('state', shortname);
								subAddrDetails['state'] = shortname;
								subAddrInternalId.push('state');
                            }
                        
								///////
								
                               /* subrec.setValue(fieldInternalId[n], shortname);
                                subAddrDetails[fieldInternalId[n]] = shortname;
                                subAddrInternalId.push(fieldInternalId[n]); */
                            } else {
								if (fieldInternalId[n] == 'subcountry') {
								var countryCode = getCountryCode(headerData[n]);
                                subrec.setValue('country', countryCode);
								subAddrDetails['country'] = countryCode;
								subAddrInternalId.push('country');
								}
                                subrec.setValue(fieldInternalId[n], headerData[n]);
                                subAddrDetails[fieldInternalId[n]] = headerData[n];
                                subAddrInternalId.push(fieldInternalId[n]);
                            }
                        } else if (fieldInternalId[n] == 'country') {
                            var countryCode = getCountryCode(headerData[n]);
                            subsidiaryRec.setValue(fieldInternalId[n], countryCode);
                        } else if (fieldInternalId[n] == 'currency') {
                            if (isCreate == true) {
                                for (i = 0; i < currencyArray.length; i++) {
                                    if (currencyArray[i].name == headerData[n]) {
                                        subsidiaryRec.setValue(fieldInternalId[n], currencyArray[i].id);
                                    }
                                }
                            } else {
                                continue;
                            }
                        } else if (fieldInternalId[n] == 'fiscalcalendar' || fieldInternalId[n] == 'taxfiscalcalendar') {
                            subsidiaryRec.setText(fieldInternalId[n], headerData[n].replace('\r', ''));
                        } else if (fieldInternalId[n] == 'shippingaddress_text') {
                            isShipAddrSame = headerData[n];
                        } else if (fieldInternalId[n] == 'returnaddress_text') {
                            isReturnAddrSame = headerData[n];
                        } else if (isNotNull(headerData[n])) {
                            if (fieldInternalId[n] != null && fieldInternalId[n] != '' && fieldInternalId[n] != undefined && fieldInternalId[n] != 'internalid') {
                                if (isBoolean(headerData[n]) === true || isBoolean(headerData[n]) === false) {
                                    subsidiaryRec.setValue(fieldInternalId[n], isBoolean(headerData[n]));
                                } else {
                                    subsidiaryRec.setText(fieldInternalId[n], isBoolean(headerData[n]));
									if(fieldInternalId[n] =='custrecord_companycode')
									{
										subsidiaryRec.setText('externalid', isBoolean(headerData[n]));
									}
                                }

                            }
                        }


                    }
                    log.debug('subsidiaryRec', subsidiaryRec);
                    var isParentmandate = subsidiaryRec.getField({
                        fieldId: 'parent'
                    }).isMandatory;
                    var parent = subsidiaryRec.getValue('parent');
                    if (isCreate == true) {
                        log.audit('createsave', 'createsave');
                        var afterSaveId = subsidiaryRec.save();
                    } else if (isCreate == false) {
                        log.audit('updateSave', 'updateSave');
                        if (isBoolean(isShipAddrSame) === true) {
                            subrec = subsidiaryRec.getSubrecord({
                                fieldId: 'shippingaddress'
                            });
                            for (var p = 0; p < subAddrInternalId.length; p++) {
                                subrec.setValue(subAddrInternalId[p], subAddrDetails[subAddrInternalId[p]]);
								log.audit(subAddrInternalId[p],subAddrDetails[subAddrInternalId[p]]);
                            }
                        }
                        if (isBoolean(isReturnAddrSame) === true) {
                            subrec = subsidiaryRec.getSubrecord({
                                fieldId: 'returnaddress'
                            });
                            for (var p = 0; p < subAddrInternalId.length; p++) {
                                subrec.setValue(subAddrInternalId[p], subAddrDetails[subAddrInternalId[p]]);
                            }
                        }
                        var afterSaveId = subsidiaryRec.save();
                    } else if (isParentmandate && isNotNull(parent)) {
                        var errorObj = error.create({
                            name: 'Parent Subsidiary Missing',
                            message: 'Parent Subsidiary is not found',
                            notifyOff: true
                        });
                        var errorString = "Error name :" + errorObj.name + " ,Error message :" + errorObj.message;
                        throw errorObj;
                    }
                    if (isBoolean(isShipAddrSame) === true || isBoolean(isReturnAddrSame) === true && isCreate == true) {
						log.audit('Updating Address','Updating Address');
                        subsidiaryRec = record.load({
                            type: record.Type.SUBSIDIARY,
                            id: afterSaveId
                            
                        });
						log.audit('Updating Address -',isBoolean(isShipAddrSame));
                        if (isBoolean(isShipAddrSame) === true) {
                            subrec = subsidiaryRec.getSubrecord({
                                fieldId: 'shippingaddress'
                            });
                            for (var p = 0; p < subAddrInternalId.length; p++) {
                                subrec.setValue(subAddrInternalId[p], subAddrDetails[subAddrInternalId[p]]);
								log.audit(subAddrInternalId[p],subAddrDetails[subAddrInternalId[p]]);
                            }
                        }
                        if (isBoolean(isReturnAddrSame) === true) {
                            subrec = subsidiaryRec.getSubrecord({
                                fieldId: 'returnaddress'
                            });
                            for (var p = 0; p < subAddrInternalId.length; p++) {
                                subrec.setValue(subAddrInternalId[p], subAddrDetails[subAddrInternalId[p]]);
                            }
                        }
                        subsidiaryRec.save();
                    }
                }


            } catch (error) {
                log.debug('delete error', error);
                if (errorFlag == false) {
                    context.write(errorCSVDataHeader);
                    errorFlag = true;
                }
                var errorString = error.message;
                errorCSVDetail = errorCSVDetail + errorString.replace(',', '') + ',';
                for (var errorloop = 0; errorloop < headerData.length; errorloop++) {
                    if (errorloop < headerData.length - 1)
                        errorCSVDetail = errorCSVDetail + '"' + headerData[errorloop] + '"' + ',';
                    else
                        errorCSVDetail = errorCSVDetail + '"' + headerData[errorloop] + '"' + '\n';
                }

                var string = errorCSVDetail;

                context.write(string);
            }

        }

        function CSVToArray(strData, strDelimiter) {
            strDelimiter = (strDelimiter || ",");
            var objPattern = new RegExp(
                (
                    // Delimiters.
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

                    // Quoted fields.
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

                    // Standard fields.
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ),
                "gi"
            );

            var arrData = [
                []
            ];
            var arrMatches = null;
            while (arrMatches = objPattern.exec(strData)) {
                var strMatchedDelimiter = arrMatches[1];
                if (
                    strMatchedDelimiter.length &&
                    strMatchedDelimiter !== strDelimiter
                ) {
                    arrData.push([]);
                }

                var strMatchedValue;
                if (arrMatches[2]) {
                    strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"),
                        "\""
                    );

                } else {
                    strMatchedValue = arrMatches[3];
                }
                arrData[arrData.length - 1].push(strMatchedValue);
            }

            // Return the parsed data.
            return (arrData);
        }

        function isBoolean(rowdata) {
            if (rowdata.toLowerCase() == "true") {
                return true;
            } else if (rowdata.toLowerCase() == "false") {
                return false;
            } else {
                return rowdata.replace('\r', '');
            }
        }

        function isNotNull(rowData) {
            if (rowData == "" || null == rowData) {
                log.debug('rowdata', rowData);
                return false;
            } else {
                log.debug('rowdata has value', rowData);
                return true
            }
        }

        function getCountryCode(countryVal) {

            var countryCode = {
                "Andorra": "AD",
                "United Arab Emirates": "AE",
                "Afghanistan": "AF",
                "Antigua and Barbuda": "AG",
                "Anguilla": "AI",
                "Albania": "AL",
                "Armenia": "AM",
                "Angola": "AO",
                "Antarctica": "AQ",
                "Argentina": "AR",
                "American Samoa": "AS",
                "Austria": "AT",
                "Australia": "AU",
                "Aruba": "AW",
                "Aland Islands": "AX",
                "Azerbaijan": "AZ",
                "Bosnia and Herzegovina": "BA",
                "Barbados": "BB",
                "Bangladesh": "BD",
                "Belgium": "BE",
                "Burkina Faso": "BF",
                "Bulgaria": "BG",
                "Bahrain": "BH",
                "Burundi": "BI",
                "Benin": "BJ",
                "Saint Barthélemy": "BL",
                "Bermuda": "BM",
                "Brunei Darrussalam": "BN",
                "Bolivia": "BO",
                "Bonaire, Saint Eustatius, and Saba": "BQ",
                "Brazil": "BR",
                "Bahamas": "BS",
                "Bhutan": "BT",
                "Bouvet Island": "BV",
                "Botswana": "BW",
                "Belarus": "BY",
                "Belize": "BZ",
                "Canada": "CA",
                "Cocos (Keeling) Islands": "CC",
                "Congo, Democratic People's Republic": "CD",
                "Central African Republic": "CF",
                "Congo, Republic of": "CG",
                "Switzerland": "CH",
                "Cote d'Ivoire": "CI",
                "Cook Islands": "CK",
                "Chile": "CL",
                "Cameroon": "CM",
                "China": "CN",
                "Colombia": "CO",
                "Costa Rica": "CR",
                "Cuba": "CU",
                "Cape Verde": "CV",
                "Curacao": "CW",
                "Christmas Island": "CX",
                "Cyprus": "CY",
                "Czech Republic": "CZ",
                "Germany": "DE",
                "Djibouti": "DJ",
                "Denmark": "DK",
                "Dominica": "DM",
                "Dominican Republic": "DO",
                "Algeria": "DZ",
                "Ceuta and Melilla": "EA",
                "Ecuador": "EC",
                "Estonia": "EE",
                "Egypt": "EG",
                "Western Sahara": "EH",
                "Eritrea": "ER",
                "Spain": "ES",
                "Ethiopia": "ET",
                "Finland": "FI",
                "Fiji": "FJ",
                "Falkland Islands": "FK",
                "Micronesia, Federal State of": "FM",
                "Faroe Islands": "FO",
                "France": "FR",
                "Gabon": "GA",
                "United Kingdom": "GB",
                "Grenada": "GD",
                "Georgia": "GE",
                "French Guiana": "GF",
                "Guernsey": "GG",
                "Ghana": "GH",
                "Gibraltar": "GI",
                "Greenland": "GL",
                "Gambia": "GM",
                "Guinea": "GN",
                "Guadeloupe": "GP",
                "Equatorial Guinea": "GQ",
                "Greece": "GR",
                "South Georgia": "GS",
                "Guatemala": "GT",
                "Guam": "GU",
                "Guinea-Bissau": "GW",
                "Guyana": "GY",
                "Hong Kong": "HK",
                "Heard and McDonald Islands": "HM",
                "Honduras": "HN",
                "Croatia/Hrvatska": "HR",
                "Haiti": "HT",
                "Hungary": "HU",
                "Canary Islands": "IC",
                "Indonesia": "ID",
                "Ireland": "IE",
                "Israel": "IL",
                "Isle of Man": "IM",
                "India": "IN",
                "British Indian Ocean Territory": "IO",
                "Iraq": "IQ",
                "Iran (Islamic Republic of)": "IR",
                "Iceland": "IS",
                "Italy": "IT",
                "Jersey": "JE",
                "Jamaica": "JM",
                "Jordan": "JO",
                "Japan": "JP",
                "Kenya": "KE",
                "Kyrgyzstan": "KG",
                "Cambodia": "KH",
                "Kiribati": "KI",
                "Comoros": "KM",
                "Saint Kitts and Nevis": "KN",
                "Korea, Democratic People's Republic": "KP",
                "Korea, Republic of": "KR",
                "Kuwait": "KW",
                "Cayman Islands": "KY",
                "Kazakhstan": "KZ",
                "Lao People's Democratic Republic": "LA",
                "Lebanon": "LB",
                "Saint Lucia": "LC",
                "Liechtenstein": "LI",
                "Sri Lanka": "LK",
                "Liberia": "LR",
                "Lesotho": "LS",
                "Lithuania": "LT",
                "Luxembourg": "LU",
                "Latvia": "LV",
                "Libya": "LY",
                "Morocco": "MA",
                "Monaco": "MC",
                "Moldova, Republic of": "MD",
                "Montenegro": "ME",
                "Saint Martin": "MF",
                "Madagascar": "MG",
                "Marshall Islands": "MH",
                "Macedonia": "MK",
                "Mali": "ML",
                "Myanmar": "MM",
                "Mongolia": "MN",
                "Macau": "MO",
                "Northern Mariana Islands": "MP",
                "Martinique": "MQ",
                "Mauritania": "MR",
                "Montserrat": "MS",
                "Malta": "MT",
                "Mauritius": "MU",
                "Maldives": "MV",
                "Malawi": "MW",
                "Mexico": "MX",
                "Malaysia": "MY",
                "Mozambique": "MZ",
                "Namibia": "NA",
                "New Caledonia": "NC",
                "Niger": "NE",
                "Norfolk Island": "NF",
                "Nigeria": "NG",
                "Nicaragua": "NI",
                "Netherlands": "NL",
                "Norway": "NO",
                "Nepal": "NP",
                "Nauru": "NR",
                "Niue": "NU",
                "New Zealand": "NZ",
                "Oman": "OM",
                "Panama": "PA",
                "Peru": "PE",
                "French Polynesia": "PF",
                "Papua New Guinea": "PG",
                "Philippines": "PH",
                "Pakistan": "PK",
                "Poland": "PL",
                "St. Pierre and Miquelon": "PM",
                "Pitcairn Island": "PN",
                "Puerto Rico": "PR",
                "State of Palestine": "PS",
                "Portugal": "PT",
                "Palau": "PW",
                "Paraguay": "PY",
                "Qatar": "QA",
                "Reunion Island": "RE",
                "Romania": "RO",
                "Serbia": "RS",
                "Russian Federation": "RU",
                "Rwanda": "RW",
                "Saudi Arabia": "SA",
                "Solomon Islands": "SB",
                "Seychelles": "SC",
                "Sudan": "SD",
                "Sweden": "SE",
                "Singapore": "SG",
                "Saint Helena": "SH",
                "Slovenia": "SI",
                "Svalbard and Jan Mayen Islands": "SJ",
                "Slovak Republic": "SK",
                "Sierra Leone": "SL",
                "San Marino": "SM",
                "Senegal": "SN",
                "Somalia": "SO",
                "Surinam": "SR",
                "South Sudan": "SS",
                "Sao Tome and Principe": "ST",
                "El Salvador": "SV",
                "Sint Maarten": "SX",
                "Syrian Arab Republic": "SY",
                "Swaziland": "SZ",
                "Turks and Caicos Islands": "TC",
                "Chad": "TD",
                "French Southern Territories": "TF",
                "Togo": "TG",
                "Thailand": "TH",
                "Tajikistan": "TJ",
                "Tokelau": "TK",
                "Turkmenistan": "TM",
                "Tunisia": "TN",
                "Tonga": "TO",
                "East Timor": "TP",
                "Turkey": "TR",
                "Trinidad and Tobago": "TT",
                "Tuvalu": "TV",
                "Taiwan": "TW",
                "Tanzania": "TZ",
                "Ukraine": "UA",
                "Uganda": "UG",
                "US Minor Outlying Islands": "UM",
                "United States": "US",
                "Uruguay": "UY",
                "Uzbekistan": "UZ",
                "Holy See (City Vatican State)": "VA",
                "Saint Vincent and the Grenadines": "VC",
                "Venezuela": "VE",
                "Virgin Islands (British)": "VG",
                "Virgin Islands (USA)": "VI",
                "Vietnam": "VN",
                "Vanuatu": "VU",
                "Wallis and Futuna Islands": "WF",
                "Samoa": "WS",
                "Kosovo": "XK",
                "Yemen": "YE",
                "Mayotte": "YT",
                "South Africa": "ZA",
                "Zambia": "ZM",
                "Zimbabwe": "ZW"
            }
            var countryKey = countryCode[countryVal];
            return countryKey;
        }

        function reduce(context) {
            log.debug('context.key', context.key);
            log.debug('context.value', context.value);
            context.write(context.key, context.values);
        }

        function summarize(summary) {
            var scriptErrorparamId = runtime.getCurrentScript().getParameter("custscript_subimporttool_folder");
            var scriptAdminparamId = runtime.getCurrentScript().getParameter("custscript_system_admin");
            var type = summary.toString();

            log.audit(type + ' Usage Consumed', summary.usage);
            log.audit(type + ' Concurrency Number ', summary.concurrency);
            log.audit(type + ' Number of Yields', summary.yields);
            var contents = '';
            summary.output.iterator().each(function(key, value) {
                contents += key.replace('\r', '');
                log.debug('Summ Comtetnts', contents);
                return true;
            });
            if (contents && contents != '' && contents != null) {
                var fileObj = file.create({
                    name: 'SUBSIDIARY ERROR LOGS',
                    fileType: file.Type.CSV,
                    contents: contents
                });
                fileObj.folder = scriptErrorparamId;
                var errorFileId = fileObj.save();
                var fileObj = file.load({
                    id: errorFileId
                });

                var erroremail = email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: runtime.getCurrentUser().id,
                    subject: "Netsuite Subsidiary Import Confirmation",
                    body: "Thank You For using NetSuite Subsidiary Import Assistance.Please find the attached sheet for the error logs.",
                    attachments: [fileObj]
                });
                log.debug('Error Email', erroremail);
            } else {
                email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: runtime.getCurrentUser().id,
                    subject: "Netsuite Subsidiary Import Confirmation",
                    body: "Thank You For using NetSuite Subsidiary Import Assistance.All your records had been successfully created.",
                });
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });