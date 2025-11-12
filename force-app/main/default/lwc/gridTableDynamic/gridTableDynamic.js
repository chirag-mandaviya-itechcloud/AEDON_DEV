import { LightningElement, api, track, wire } from 'lwc';
import getObjectRecordData from '@salesforce/apex/GridTableDynamicController.getObjectRecordData';
import findForeignKey from '@salesforce/apex/GridTableDynamicController.findForeignKey';
import fetchFields from '@salesforce/apex/GridTableDynamicController.fetchFields';
import updateRecord from '@salesforce/apex/GridTableDynamicController.updateRecord';
import deleteRecord from '@salesforce/apex/GridTableDynamicController.deleteRecord';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
//import getSalesInvoiceHeader from '@salesforce/apex/aedonSIController.getSalesInvoiceHeader';
import getVATRecords from '@salesforce/apex/GridTableDynamicController.getVATRecords';
import { getRecord } from 'lightning/uiRecordApi';
//import getAnalysisLabels from '@salesforce/apex/GridTableDynamicController.getAnalysisLabels';
import addProductDefaults from '@salesforce/apex/GridTableDynamicController.addProductDefaults';
import getTaxCodes from '@salesforce/apex/GridTableDynamicController.getTaxCodes';


export default class GridTableDynamic extends NavigationMixin(LightningElement) {
    @api parentId //parent object's record id (Parent Id) from FLOW
    @api recordId //parent object's record id (Parent Id)
    @api objectApiName //parent objectAPIName (ParentAPIName)
    @api childObjectApiName //from page layout by user
    @api childObjectLabel //from page layout by user
    @api fieldSetName
    @api parentChildRelationApiName
    @api sortingFields
    @api sortingOrder

    @track data = [];
    @track columns = [{ label: '', fieldName: '', type: '' }];

    @track showLoader = true;
    @track toggleSaveLabel = 'Save';
    @track isEdited = false;
    @track mainIdToDelete = '';
    @track mainIndex;
    @track saveButtonDisable = false;
    @track sumOfTransactionAmount;
    @track sumOfTaxPayable;
    @track sumofGrossAmount;
    @track totalDebit;
    @track totalCredit;
    @track colSpanSizes;
    @track allColSpanSizes;
    @track totalAmount;
    @track isJournal = false;
    @track totalIsOutByNotZero = false;
    @track totalIsOutByValue;
    @track showNet = false;
    @track showTaxAmt = false;
    @track showGross = false;
    @track eligibleCount = 0;

    @track toastMessage = '';
    @track showToastMessage = false;

    dataValue = {};

    containsReferenceToParent = false;
    showDeleteBox = false;
    rowOffset = 0;
    rowId;
    parentRecordId = '';
    parentObjectApiName = '';
    foreignKey = '';
    tempData = [];
    isAvalaibleForEdit = false;
    isPoaTransaction = false;
    salesInvoiceStatus;
    hideAddButton = false;
    salesPOA = false;
    @track isNoRecords = false;
    requiredFieldsMap = [];
    @track taxList = [];
    @track showTaxData = false;


    connectedCallback() {
        //console.log('Enter in call', JSON.parse(JSON.stringify(this.data)));
        const style = document.createElement('style');
                    style.innerText = `
                        .action_btn svg {
                            fill:#16684E !important;
                        }
                    `;
                     setTimeout(() => {
                        this.template.querySelector('.overrideStyle').appendChild(style);
                    }, 200);
        
        this.parentObjectApiName = this.objectApiName ? this.objectApiName : this.childObjectApiName;
        
        // calling from Flow so i added this condition 
        if(this.recordId != undefined){
            this.parentRecordId = this.recordId;
        }else{
            this.parentRecordId = this.parentId;
        }
        
        this.foreignKey = this.parentChildRelationApiName;

        // console.log('Inside Connected callback');
        console.log('parentObjectApiName: ' + this.parentObjectApiName);
         console.log('foreignKey: ' + this.foreignKey);
         console.log('sortingFields: ' + this.sortingFields);
         console.log('sortingOrder: ' + this.sortingOrder);

        console.log('FieldSetName:: ' + this.fieldSetName + ' ' + '\nChild Object Api Name:: ' + this.childObjectApiName + '\nParent RecordId :: ' + this.parentRecordId + '\nParent Object Api Name :: ' + this.parentObjectApiName)

        this.prepareColumns();

        if (!this.foreignKey) {
            //console.log('Finding Foreign Key as not given by user:');
            this.findRelationKey(); //set this.foreignKey
        }
        //this.fetchSalesInvoiceHeader();

        // Logic for hide sumOfTransactionAmount and sumOfTaxPayable from UI in case of Sales poa Transaction
        // console.log('this.fieldSetName : '+this.fieldSetName);
     //   if (this.fieldSetName == 's2p3__Sales_POA_Transaction' || this.fieldSetName == 's2p3__Purchase_POA_Transaction') {
            //this.fieldSetName == 's2p3__Sales_POA_Transaction' ? this.isPoaTransaction = true : this.isPoaTransaction = false;
      /*      this.isPoaTransaction = true;
        } */
        if(this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' || this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c') {
            this.isJournal = true;
        } 
        if(this.fieldSetName == 's2p3__Bank_Payment_Transaction__c' || this.fieldSetName == 's2p3__Bank_Payment_Transaction__c' ||  this.fieldSetName == 's2p3__Journal_Line_Item_Component_Fields') {
            this.isJournal = true;
        } 
          if (this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Sales_Invoice_Lines__c') {
            this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' ? this.isPoaTransaction = true : this.isPoaTransaction = false;
            this.isPoaTransaction = true;
        }

    }

    // Dynamically construct fields based on the objectApiName
    get fields() {
        return [
            `${this.objectApiName}.Id`,
            `${this.objectApiName}.Name`,
            `${this.objectApiName}.s2p3__Posting_Status__c`,
        ];
    }

    @wire(getRecord, { recordId: '$recordId', fields: '$fields' })
    wiredRecord({ error, data }) {
        if (data) {
            console.log('Record Data:', data);
            this.salesInvoiceStatus = data.fields.s2p3__Posting_Status__c.value;
            this.isAvalaibleForEdit = this.salesInvoiceStatus !== 'Posted';
            this.hideAddButton = this.salesInvoiceStatus === 'Posted' ? true : false;
            console.log('this.hideAddButton',this.hideAddButton);
            console.log('this.isAvalaibleForEdit',this.isAvalaibleForEdit);
            
        } else if (error) {
            //console.error('Error fetching record:', error);
        }
    }

    fetchSalesInvoiceHeader() {
        getSalesInvoiceHeader({ recordId: this.recordId })
            .then((result) => {
                console.log('result@@@@',result);
                
                if (result && result.length > 0) {
                    this.salesInvoiceStatus = result[0].s2p3__Posting_Status__c;
                    if (this.salesInvoiceStatus == 'Posted') {
                        this.isAvalaibleForEdit = false;
                    }else {
                        this.isAvalaibleForEdit = true;
                    }
                }
            })
            .catch((error) => {
                console.error('Error fetching Sales Invoice Header:', error);
            });
    }

    //prepare columns of the table
    prepareColumns() {

        fetchFields({
            objectApiName: this.childObjectApiName,
            fieldSetName: this.fieldSetName,
            parentRecordId: this.parentRecordId,
            parentObjectApiName: this.parentObjectApiName
        })
            .then((result) => {
                //console.log('@@@prepareColumns Result :: ', result);
                let mColumn = [...this.columns];
                mColumn = []; //pop all

                //add the columns into the data table
                result.forEach((currentItem) => {
                    console.log('@@@prepareColumns: currentItem', currentItem)
                    let col = {
                        isRequired: currentItem.required,
                        label: currentItem.label,
                        fieldName: currentItem.fieldName,
                        type: currentItem.type,
                        referenceTo: currentItem.referenceTo,
                        isParentReferenceItself: currentItem.referenceTo == this.parentObjectApiName ? true : false, //Opportunity == Opportunity
                        disabled: !currentItem.editable,
                        //isUpdateable: currentItem.editable,
                        isText: currentItem.type == 'text' ? true : false,
                        isTextAreaRich: currentItem.type == 'richArea' ? true : false,
                        isTextAreaLong: currentItem.type == 'areaLong' ? true : false,
                        isCheckbox: currentItem.type == 'boolean' ? true : false,
                        isAddress: currentItem.type == 'address' ? true : false,
                        isDate: currentItem.type == 'date' ? true : false,
                        isDateLocal: currentItem.type == 'date-local' ? true : false,
                        isLookUp: currentItem.type == 'lookup' ? true : false,
                        isEmail: currentItem.type == 'email' ? true : false,
                        isPicklist: currentItem.type == 'checkbox' ? true : false,
                        isDependentPicklist: currentItem.type == 'dependentPicklist' ? true : false,
                        isCurrency: currentItem.type == 'currency' ? true : false,
                        isNumber: currentItem.type == 'number' ? true : false,
                        isMultiSelectPicklist: currentItem.type == 'MultiSelect-Piklist' ? true : false,
                        isUrl: currentItem.type == 'url' ? true : false,
                        isTime: currentItem.type == 'time' ? true : false,
                        isTaxAvailable: currentItem.fieldName == 's2p3__Tax_Amount__c'? true: false
                    };

                    //if there are any fields from the parent object - extract it and put it manually out side
                    let isParentReference = String(currentItem.fieldName).split('.');
                    if (isParentReference.length > 1 && isParentReference != null) {
                        this.containsReferenceToParent = true;
                        //console.log('this is parent reference extracting everything from inside ::: ' + currentItem.fieldName)
                    }
                    mColumn.push(col);
                });

                this.columns = mColumn;
                this.columnsWithoutFilter = mColumn;
                console.log('this.colums @@', this.columns);
                this.columns = this.columns.filter(column => !column.fieldName.includes('.'));
                this.eligibleCount = 0;
                this.columns.forEach(col => {
                    switch (col.fieldName) {
                    case 's2p3__Tax_Amount__c':
                        this.showTaxAmt = true;
                        this.eligibleCount++;
                        break;
                    case 's2p3__Net_Amount__c':
                        this.showNet = true;
                        this.eligibleCount++;
                        break;
                    case 's2p3__Gross_Amount__c':
                        this.showGross = true;
                        this.eligibleCount++;
                        break;
                    default:
                        break;
                    }
                });


                 this.requiredFieldsMap = this.columns
                    .filter(field => field.isRequired) // Include only fields where isRequired is true
                    .map(field => {
                        return {
                            label: field.label,
                            fieldName: field.fieldName
                        };
                    });
                
              //  getAnalysisLabels()
              //      .then((data) => {
                        
              //          this.columns = this.columns.map(column => {
                            // Check if data contains a label for the column's referenceTo
              //              if (column.referenceTo && data[column.referenceTo]) {
              //                  console.log('Updating label for:', column.referenceTo);
              //                  console.log('Current label:', column.label);
              //                  console.log('New label:', data[column.referenceTo]);

                                // Return a new column object with the updated label
                //                return { ...column, label: data[column.referenceTo] };
                //            }

                            // Return the column unchanged if no match is found
               //             return column;
                //        });

                //    }
                //    ).catch((error) => {
                //        console.log('error getAnalysisLabels',error);
                        
                //    })
                

                console.log('columns: ', JSON.parse(JSON.stringify(this.columns)));

                //columns added to data table now fetch records
                this.getRecordData();

            }).catch((error) => {
                this.showToast('Error', error.body.message, 'Error');
                console.error('error in prepareColumns: ', error);
                this.showLoader = false;
            })
    }

    //Query all the object data
    getRecordData() {
        console.log('Query all the object data');
        
        this.showLoader = true;

        getObjectRecordData({
            objectAPIName: this.childObjectApiName,
            fieldSetName: this.fieldSetName,
            parentRecordId: this.parentRecordId,
            parentObjectApiName: this.parentObjectApiName,
            parentChildRelationApiName: this.parentChildRelationApiName,
            sortingFields: this.sortingFields,
            sortingOrder: this.sortingOrder
        }).then((result) => {
console.log('getrecord result@@@'+result);

            if (result != null && result != '') {
                this.formateResult(result);
            } else {
                //this.showToast('Error', 'No records to display', 'Error');
                this.allColSpanSizes = 0;
                this.allColSpanSizes =(Object.keys(this.columns).length) + 1;
                this.isNoRecords = true;
                this.showLoader = false;
               if(this.fieldSetName === 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' || this.fieldSetName == 's2p3__Bank_Payment_Transaction__c'){
                 this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' ? this.hideAddButton = false : this.hideAddButton = true;
                 this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' ? this.hideAddButton = false : this.hideAddButton = true;
                 this.fieldSetName == 's2p3__Bank_Payment_Transaction__c' ? this.hideAddButton = false : this.hideAddButton = true;
                   this.hideAddButton = false;
                }
            }
        })
            .catch((error) => {
                console.error('Error in getObjectRecordData: ', error);
                this.showToast('Error', error.body.message, 'Error');
                console.error('Error in getObjectRecordData: ', error);
                this.showLoader = false;
            });
    }

    //formate the object record result
    formateResult(result) {
        let mData = [];
        let mDataItem = {};
        console.log('result==>', JSON.stringify(result));

        result.forEach((currentItem) => {
            mDataItem = { ...currentItem, recordURL: `/${currentItem.Id}` };

            // Handle parent relationships (like s2p3__Product__r.Name)
            for (const key in currentItem) {
                if (typeof currentItem[key] === 'object' && currentItem[key] !== null) {
                    let parent = currentItem[key];
                    for (const key2 in parent) {
                        mDataItem[key + '.' + key2] = parent[key2];
                    }
                }
            }

            // 🔹 Format decimal fields to 2 decimal places
            const decimalFields = [
                's2p3__Net_Amount__c',
                's2p3__Tax_Amount__c',
                's2p3__Gross_Amount__c',
                's2p3__Debit__c',
                's2p3__Credit__c'
            ];

            decimalFields.forEach(field => {
                if (mDataItem[field] !== undefined && mDataItem[field] !== null) {
                    mDataItem[field] = parseFloat(mDataItem[field]).toFixed(2);
                }
            });

            // Push to main list
            mData.push(mDataItem);
        });

        this.data = mData;
        if (this.fieldSetName == 's2p3__Sales_Invoice_Lines__c'  || this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' || this.fieldSetName == 's2p3__Bank_Payment_Transaction__c') {
            this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' && this.data.length > 0 ? this.hideAddButton = true : this.hideAddButton = false;
            this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' && this.data.length > 0 ? this.salesPOA = true : this.salesPOA = false;
            this.data.length > 0 ? this.hideAddButton = true : this.hideAddButton = false;
            this.data.length > 0 ? this.salesPOA = true : this.salesPOA = false;
        }
        console.log('this.hideAddButton 286',this.hideAddButton);
        console.log('this.salesPOA 286',this.salesPOA);
        
        this.sumOfTransactionAmount = 0.00;
        this.sumOfTaxPayable = 0.00;
        this.sumofGrossAmount = 0.00;
        this.totalDebit = 0.00;
        this.totalCredit = 0.00;
        this.colSpanSizes = 0;
        this.totalAmount = 0;
        console.log('table data@@@@',JSON.stringify(this.data));
        
        this.data.forEach((currentItem) => {
            console.log('currentItem=>',JSON.stringify(currentItem));
            if (currentItem.s2p3__Net_Amount__c) {
                this.sumOfTransactionAmount += parseFloat(currentItem.s2p3__Net_Amount__c);
            } 
            if (currentItem.s2p3__Tax_Amount__c) {
                this.sumOfTaxPayable += parseFloat(currentItem.s2p3__Tax_Amount__c);
            }
            if(currentItem.s2p3__Gross_Amount__c) {
                this.sumofGrossAmount += parseFloat(currentItem.s2p3__Gross_Amount__c);
            }
            //uncomment from line number 345 to 351
            if(currentItem.s2p3__Debit__c){
                this.totalDebit += parseInt(currentItem.s2p3__Debit__c);
            }
            if(currentItem.s2p3__Credit__c){
                this.totalCredit += parseInt(currentItem.s2p3__Credit__c);
            } 
        })  


        this.sumOfTransactionAmount = parseFloat(this.sumOfTransactionAmount.toFixed(2)).toFixed(2);
        this.sumOfTaxPayable = parseFloat(this.sumOfTaxPayable.toFixed(2)).toFixed(2);
        //uncomment from line number 356 to 364
        this.totalDebit = parseFloat(this.totalDebit.toFixed(2)).toFixed(2);
        this.totalCredit = parseFloat(this.totalCredit.toFixed(2)).toFixed(2);
        if(this.totalDebit - this.totalCredit < 0 || this.totalDebit - this.totalCredit > 0){
            this.totalIsOutByNotZero = true;
            this.totalIsOutByValue = this.totalDebit - this.totalCredit;
        }else{
            this.totalIsOutByNotZero = false;
        } 
        

      //   Calculate and round the total amount
        this.totalAmount = parseFloat((parseFloat(this.sumOfTransactionAmount) + parseFloat(this.sumOfTaxPayable)).toFixed(2)).toFixed(2);

        // format the number 14400 to 14,400.
        this.sumOfTransactionAmount = Number(this.sumOfTransactionAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.sumOfTaxPayable = Number(this.sumOfTaxPayable).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.sumofGrossAmount = Number(this.sumofGrossAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.totalAmount = Number(this.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.totalDebit = Number(this.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.totalCredit = Number(this.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.totalIsOutByNotZero = Number(this.totalIsOutByNotZero).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        this.colSpanSizes =(Object.keys(this.columns).length) - (this.eligibleCount + 1);
        console.log('this.colSpanSizes=>',JSON.stringify(this.colSpanSizes));
    //    if(this.fieldSetName == 's2p3__Journal_Line_Item_Component_Fields') {
    //         this.colSpanSizes = this.colSpanSizes - 1;
    //     } 
        
        this.showLoader = false;
        console.log('@@@formateResult Returning : ', JSON.parse(JSON.stringify(this.data))); 
    } 

    getTaxCodeData(event) {
        const taxId = event.currentTarget.dataset.taxId;
        const rowId = event.currentTarget.dataset.rowId;
        console.log('Clicked Tax Id:', taxId);

        getTaxCodes({ taxID: taxId })
        .then((result) => {
            console.log('result',result);

            if (result) {
                // find net amount of the clicked row
                let rowNetAmount = 0;
                const clickedRow = this.data.find(r => r.Id === rowId);
                console.log('clickedRow@@',clickedRow);
                
                if (clickedRow && clickedRow.s2p3__Net_Amount__c) {
                    rowNetAmount = clickedRow.s2p3__Net_Amount__c;
                }

                // enrich tax records with calculated Amount
                this.taxList = result.map(tax => {
                    const rawAmount = (rowNetAmount * tax.s2p3__Tax_Rate__c) / 100;
                    const formattedAmount = rawAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return { ...tax, Amount: formattedAmount };
                });
                console.log('this.data@@@@@'+JSON.stringify(this.data));
                
                 this.data = this.data.map(row => {
                    if (row.Id === rowId) {
                        return { ...row, showTax: true };
                    }
                    return { ...row, showTax: false }; // close others
                });
            } else if (error) {
                console.error(error);
            }            

        })
        .catch((error) => {
            this.error = error;
            console.error('error',error);
        });

        // now you can use taxId in your logic
    }

    closeTaxPopup(event) {
        const rowId = event.currentTarget.dataset.rowId;
        this.data = this.data.map(row => {
            if (row.Id === rowId) {
                return { ...row, showTax: false }; // close this row
            }
            return row;
        });
    }

    //Get the changed data from Override Input custom component
    handleDataChange(event) {
        var indx = parseInt(event.detail.currentRowIndex);
        // console.log('event.detail',event.detail.isRequired,"  ==  Fieldname",event.detail.fieldName);
        // console.log('indx',indx);
        // console.log('columns l',this.columns.length);
        // console.log('columns ',this.columns);
        // console.log('this.data[indx] ',this.data[indx]);

        // this.columns[7].disabled = true;

        var data = JSON.parse(JSON.stringify(this.data));
        var recId = this.data[indx]['Id'];
        let element = {}
        let index = this.tempData.findIndex(object => {
            return object.Id == recId;
        });

        if (index == -1) {
            element = {
                'Id': recId
            }
console.log('recId.includes', recId.includes('New'));
console.log('this.foreignKey',this.foreignKey);
            if (recId.includes('New') && this.foreignKey != null && this.foreignKey != '') {
                element[this.foreignKey] = this.parentRecordId;
            }
            console.log('element!!! up@@', element);
            element[event.detail.fieldName] = event.detail.value;
            console.log('element!!!@@', element);
            this.tempData.push(element);
        } else {
            this.tempData[index][event.detail.fieldName] = event.detail.value;
            
        }

        console.log('hgfhfu', this.tempData);
               

        console.log('data',this.data); 

        this.tempData = this.tempData.map(tempItem => {
            // Loop through each column in this.columns
            this.columns.forEach(column => {
                // Only consider columns that are required
                if (column.isRequired) {
                    const fieldName = column.fieldName;

                    // If the field is not already present in tempItem (it might be missing)
                    if (!(fieldName in tempItem)) {
                        // Find the matching entry in this.data based on the Id
                        const matchingDataItem = this.data.find(dataItem => dataItem.Id === tempItem.Id);

                        // If we have a matching data item and the field exists, set it in tempItem
                        if (matchingDataItem && matchingDataItem[fieldName] != null && matchingDataItem[fieldName] !== '') {
                            tempItem[fieldName] = matchingDataItem[fieldName];
                        } else {
                            // If no matching data or field is null/empty, set the field to null
                            tempItem[fieldName] = null;
                        }
                    }
                }
            });

            // Now apply the logic from the previous code to update the fields from this.data
            const matchingDataItem = this.data.find(dataItem => dataItem.Id === tempItem.Id);

            if (matchingDataItem) {
                // Loop through the fields and update tempItem with matching data if the field is not already populated
                if (matchingDataItem.s2p3__Quantity__c != null && matchingDataItem.s2p3__Quantity__c !== '' && tempItem.s2p3__Quantity__c == null) {
                    tempItem.s2p3__Quantity__c = Number(matchingDataItem.s2p3__Quantity__c);
                }
                if (matchingDataItem.s2p3__Unit_Price__c != null && matchingDataItem.s2p3__Unit_Price__c !== '' && tempItem.s2p3__Unit_Price__c == null) {
                    tempItem.s2p3__Unit_Price__c = matchingDataItem.s2p3__Unit_Price__c;
                }
                if (matchingDataItem.s2p3__Tax_Group__c != null && matchingDataItem.s2p3__Tax_Group__c !== '' && tempItem.s2p3__Tax_Group__c == null) {
                    tempItem.s2p3__Tax_Group__c = matchingDataItem.s2p3__Tax_Group__c;
                }
                
                if (matchingDataItem.s2p3__Discount__c != null && matchingDataItem.s2p3__Discount__c !== '' && tempItem.s2p3__Discount__c == null) {
                    tempItem.s2p3__Discount__c = matchingDataItem.s2p3__Discount__c;
                }
            }

            return tempItem;
        });

            
    //  ------------------------------------------------------- Net Transaction calculation Start----------------------------------------------------------------------------      
console.log('this.fieldSetName!!',this.fieldSetName);
        if (this.fieldSetName === 's2p3__Line_Item_Component_Fields'  || this.fieldSetName === 's2p3__Sales_Credit_Transaction' || this.fieldSetName === 's2p3__Recurring_Sales_Invoice_Transaction' || this.fieldSetName === 's2p3__Purchase_Credit_Transaction__c' || this.fieldSetName === 's2p3__Purchase_Invoice_Transaction_Field_Set' || this.fieldSetName === 's2p3__Purchase_Order_Transaction' || this.fieldSetName === 's2p3__Purchase_Credit_Transaction_Field_Set' || this.fieldSetName === 's2p3__Sales_Order_Transaction_Field_Set' || this.fieldSetName === 's2p3__Proforma_Sales_Invoice_Transaction_Field') {
       console.log('Enter!!!',this.tempData[index]);
            if (
                    this.tempData[index] != undefined && Array.isArray(this.tempData) &&
                   this.tempData[index].hasOwnProperty('s2p3__Unit_Price__c') && this.tempData[index]['s2p3__Unit_Price__c'] != null
                ) {////this.tempData[index].hasOwnProperty('s2p3__Quantity__c') && this.tempData[index]['s2p3__Quantity__c'] != null && 
                       
                let discount = ((+(this.tempData[index]['s2p3__Quantity__c']) * +(this.tempData[index]['s2p3__Discount__c'] || 0) * +(this.tempData[index]['s2p3__Unit_Price__c'])) / 100);
                let sum = (+this.tempData[index]['s2p3__Quantity__c']) * + (this.tempData[index]['s2p3__Unit_Price__c']);
                console.log('discount',discount);
                console.log('sum',sum);
                this.netTrans = sum - discount
                this.tempData[index]['s2p3__Net_Amount__c'] = this.netTrans;
                //console.log("Sending this list to Apex.... " + JSON.stringify(this.tempData));

                this.template.querySelectorAll('c-override-input-g-d-t').forEach(i=>{

                    i.manuallyEnterNetTransaction(this.netTrans, indx);
                });
                
            }
        
            if (this.tempData[index] != undefined && Array.isArray(this.tempData) && ((this.tempData[index].hasOwnProperty('s2p3__Tax_Group__c')))) {
               
                console.log('ENetre getre id',this.tempData[index]['s2p3__Tax_Group__c']);

                let id;

                if (this.tempData[index].hasOwnProperty('s2p3__Tax_Group__c')) {
                    id = this.tempData[index]['s2p3__Tax_Group__c'];
                }
                 console.log('id=='+id);
                getVATRecords({ recordID: id })
                    .then((result) => {
                        console.log('result',result);
                        this.vatRecordRate = result;
                        console.log('this.netTrans@'+this.netTrans);
                        
                        this.tax = this.netTrans * this.vatRecordRate / 100;
                        this.grossAmount = this.netTrans + this.tax;;
                        //console.log('this.vatRecordRate',this.vatRecordRate);

                        this.template.querySelectorAll('c-override-input-g-d-t').forEach(i=>{
                            i.manuallyEnterTax(this.tax,indx);
                        });
                        this.template.querySelectorAll('c-override-input-g-d-t').forEach(i=>{
                            i.manuallyEnterGrossAmount(this.grossAmount,indx);
                        });
                        this.tempData[index]['s2p3__Tax_Amount__c'] = this.tax;
                        this.tempData[index]['s2p3__Gross_Amount__c'] = this.grossAmount;

                        console.log('this.tempData[index]!!',this.tempData[index]);

                    })
                    .catch((error) => {
                        this.error = error;
                    });
                    
                    
            }
        }

        if(this.fieldSetName === 's2p3__Sales_POA_Transaction' || this.fieldSetName == 's2p3__Purchase_POA_Transaction'){
            if (
                this.tempData[index] != undefined && Array.isArray(this.tempData) &&
                this.tempData[index].hasOwnProperty('s2p3__Quantity__c') && this.tempData[index]['s2p3__Quantity__c'] != null && 
                this.tempData[index].hasOwnProperty('s2p3__Unit_Price__c') && this.tempData[index]['s2p3__Unit_Price__c'] != null
            ) {
                //console.log('Enter in COndi');
                let netTrans = (this.tempData[index]['s2p3__Quantity__c']) * (this.tempData[index]['s2p3__Unit_Price__c']);
                //console.log('netTrans ',netTrans);
                this.netTrans = netTrans;
                this.tempData[index]['s2p3__Net_Transaction_Amount__c'] = this.netTrans;

                this.template.querySelectorAll('c-override-input-g-d-t').forEach(i=>{

                    i.manuallyEnterNetTransaction(this.netTrans, indx);
                });
                
            }
        }

        //console.log('09090',JSON.stringify(this.tempData));
    //  ------------------------------------------------------------Net Transaction calculation End-----------------------------------------------------------------------  

        this.data = data;
        
        
           // this.data = this.tempData;
           
            console.log('this.data',this.data);

    }

    handleDataCapture(e) {
        console.log(e.detail.currentRow, ' '+e.detail.currentRowIndex,' ' ,e.detail.fieldName);
        const obj = this.data[e.detail.currentRowIndex];
        this.data[e.detail.currentRowIndex] = {...obj, ...e.detail.currentRow};

        const check = new Set();
        this.columns.filter(i=>i.disabled === false).forEach(i=>check.add(i.fieldName));

        this.tempData = [];

        this.data.forEach((i, inx)=>{
            Object.keys(i).forEach(j=>{
                const obj = {};
                if(check.has(j)) {
                    obj[j] = this.data[inx][j];
                    this.tempData[inx] = obj; 
                }
            });
        })
        console.log("data======>"+JSON.parse(JSON.stringify(this.tempData)));
    }

    //to find the key field which connects the child to parent
    findRelationKey() {

        findForeignKey({
            objectAPIName: this.childObjectApiName,
            parentObjectApiName: this.parentObjectApiName
        }).then((result) => {
            if (result != null || result != '') {
                this.foreignKey = result;
                //console.log('Found foreignKey::: ', this.foreignKey);
            }
        }).catch((error) => {
            this.showToast('Error', 'Please refresh the page or try removing out of the scope field from the fieldSet', error);
            console.error(error);
            this.showLoader = false;
        })
    }

    //When insert button is clicked
    handleAdd() {
        this.isEdited = true;

        var first = {};
        const filterResult = (JSON.parse(JSON.stringify(this.columns))).filter(item => item.disabled === false);
        console.log('Filter :: ', JSON.parse(JSON.stringify(filterResult)))

        filterResult.forEach(item => {
            if (item.fieldName === 's2p3__Discount__c' || item.fieldName == 's2p3__Debit__c' || item.fieldName == 's2p3__Credit__c') {
                first[item.fieldName] = 0.00;
            }else {
                first[item.fieldName] = null;
            }
            console.log('first',first[item.fieldName],' '+item.fieldName);
        })

        //Foreign Key's value will be Parent Record Id itself & if there is not any connection don't set it
        if (this.foreignKey != null && this.foreignKey != '')
            first[this.foreignKey] = this.parentRecordId;

        first['Id'] = 'New' + Math.random().toString(36).substring(2, 15);
        console.log('first',first['Id']);
        
        //TODO: Add parentRecordId into Foreign Key
        first['isDisabled'] = true;
        //console.log('Adding this First :: ', JSON.parse(JSON.stringify(first)));
        if (this.data == null)
            this.data.push(first);
        else
            this.data.unshift(first);
        console.log('@@After Adding 1 Row: ', JSON.parse(JSON.stringify(this.data)));
        if (this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' || this.fieldSetName == 's2p3__Bank_Payment_Transaction__c') {
            //this.fieldSetName == 's2p3__Sales_POA_Transaction' ? this.hideAddButton = true : this.hideAddButton = false;
            this.hideAddButton = true;
        }
       

    }

    //commit the changes to the object via apex
    handleSaveClick() {
        this.showLoader = true;
        this.toggleSaveLabel = 'Saving...'
        const restoreTempDate = JSON.parse(JSON.stringify(this.tempData));

        this.tempData.forEach(e => {
            if (e['Id'] != null && e['Id'].includes('New') ) {
                e['Id'] = null
            }
        })
        
        console.log('@@@handleSaveClick :: this.tempData: ', this.tempData);
        let allMissingFields = []; 
            this.tempData.forEach((record, index) => {
                const missingFields = this.requiredFieldsMap
                    .filter(field => !(field.fieldName in record) || !record[field.fieldName])
                    .map(field => field.label);
            
                if (missingFields.length > 0) {
                    allMissingFields.push(`Record ${index + 1}:\n- ${missingFields.join("\n- ")}`);
                }
            });
            
            // Display toast messages
            if (allMissingFields.length > 0) {
                const message = `Please fill the following fields:\n\n${allMissingFields.join("\n\n")}`;
                this.showToast("Missing Fields", message, "error");
                this.showLoader = false;
                this.tempData = JSON.parse(JSON.stringify(restoreTempDate));
                return;
            } else {
                try {
                    updateRecord({
                        data: this.tempData,
                        objectApiName: this.childObjectApiName
                    }).then((result) => {
                        this.toggleSaveLabel = 'Saved';
                        this.showToast('Success', 'Record Update Successfully', 'success');
        
                        this.isEdited = false;
                        this.columns = [];
                        this.data = [];
                        this.tempData = [];
                        this.isNoRecords = false;
                        
        
                        //Refresh whole table
                        this.prepareColumns({ objectApiName: this.childObjectApiName })
                        if(this.recordId == undefined){
                            this.redirectToRecordPage(this.parentRecordId); // Redirect to the record page
                        }
                        
        
                    }).catch(error => {
                        console.error('Error in updateRecord: ', error);
                        if(this.recordId == undefined){
                            this.showToastMessage = true;
                            this.toastMessage = error.body.message
                        }else {
                            this.showToastMessage = false;
                        }
                        this.showToast('Updating Failed!', error.body.message, 'error');
                        this.tempData = JSON.parse(JSON.stringify(restoreTempDate));
                        this.showLoader = false;
                    }).finally(() => {
                        setTimeout(() => {
                            this.toggleSaveLabel = 'Save';
                        }, 1000);
                    });
                } catch (error) {
                    console.error('error', error);
                    this.showToast('Error', error.body.message, 'Error');
                }
            }
                
           

        
    }



    //turn off edit mode when clicked cancel button
    handleCancel() {
        this.showLoader = true;
        this.isEdited = false;
        let newList = this.data;
        let newMyList = newList.map(item => {
            return { ...item, isDisabled: false };
        })
        this.data = newMyList;
        this.prepareColumns();
    }

    redirectToRecordPage(recordId) {
            if (!recordId) {
                console.error('Error: recordId or masterObjectAPIName is missing!');
                return;
            }        
            
                try {
                    window.location.href = '/' + recordId;
                } catch (error) {
                    console.error('Error showing alert:', error);
                }
        }


    //When Delete icon is clicked - set the id and show the confirmation box
    handleDeleteIconClick(event) {
        let indexPosition = event.currentTarget.name;
        const recId = event.currentTarget.dataset.id;
        this.mainIdToDelete = recId.startsWith('New') ? null : recId;
        this.mainIndex = indexPosition;

        //console.log('Inside Delete....')
        //console.log('RecId: ' + recId);
        //console.log('this.mainIdToDelete: ' + this.mainIdToDelete);
        //console.log('IndexPosition: ' + indexPosition);

        if (this.mainIdToDelete != null) {
            this.showDeleteBox = true;
        } else {
            //console.log('Inside last else Condition: ' + recId);
            //Just remove the empty row
            this.data.splice(indexPosition, 1);
            //console.log('Spliced the empty row');
            //this.tempData = [];
        }
        if(this.fieldSetName === 's2p3__Sales_Invoice_Lines__c' || this.fieldSetName == 's2p3__Sales_Invoice_Lines__c'  ||  this.fieldSetName == 's2p3__Bank_Receipt_Transaction__c' || this.fieldSetName == 's2p3__Bank_Payment_Transaction__c'){
            //this.fieldSetName == 's2p3__Sales_POA_Transaction' ? this.hideAddButton = false : this.hideAddButton = true;
            //console.log('this.hideAddButton 589',this.hideAddButton);
            this.hideAddButton = false;
        }
        
    }

    //handle delete clicked
    handleDeleteClicked() {
        this.showLoader = true;
        deleteRecord({ toDeleteId: this.mainIdToDelete, objectApiName: this.childObjectApiName })
            .then((result) => {
                this.showToast('Success', 'Record deleted successfully', 'success');

                this.data.splice(this.mainIndex, 1);
                this.mainIndex = null;
                this.mainIdToDelete = '';
                this.showLoader = false;
                this.showDeleteBox = false;
                this.handleRefresh();
            })
            .catch(error => {
                console.error('@@@Error in delete: ' + JSON.stringify(error));
                this.showToast('Error', error.body.message, 'Error');
            })
    }

    //got to edit mode
    onDoubleClickEdit() {
        if (this.isAvalaibleForEdit) {
            this.showLoader = true;
            this.isEdited = true;

            let newList = this.data;
            const newMyList = newList.map(item => {
                return { ...item, isDisabled: true };
            })

       /*     let fieldsToEnable = ["s2p3__Product_Description__c","s2p3__External_Product_Description__c","s2p3__Sub_Ledger__c"];
            
            this.columns =  this.columns.map(item => {
                return {
                    ...item,
                    disabled: fieldsToEnable.includes(item.fieldName) ? false : true
                };
            }) */

            this.data = newMyList;

            this.showLoader = false;
        }
        
    }

    hideDeleteBox() {
        this.showDeleteBox = false;
    }

    handleRefresh() {
        this.isEdited = false;
        this.showLoader = true;
        this.data = [];
        this.columns = [];
        this.prepareColumns();
    }

    //TODO: This function is not being used as inline creation feature is implemented
    handleNewClick() {
        //console.log('Inside New Click');
        //console.log('@@@@@Object Api Name: ' + this.childObjectApiName);
        this.navigateToNewRecordPage();
    }

    get getIsEdited() {
        return this.isEdited;
    }

    //TODO: This function is not being used as inline creation feature is implemented
    navigateToNewRecordPage() {
        //console.log('Navigating to New Record Creation of:', this.childObjectApiName);
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: this.childObjectApiName,
                actionName: 'new'
            }
        });
    }

    get getSaveButtonDisable() {
        //return this.saveButtonDisable;
        return !this.isEdited;
    }

    get getCancelButtonDisable() {
        //return this.saveButtonDisable;
        return !this.isEdited;
    }

    handleAddProductDefult(){
        console.log('SObjectApiName: ', this.parentChildRelationApiName);
        console.log('recordId: ', this.parentRecordId);
        console.log('childSObjectApiName: ', this.childObjectApiName);
        // this.showLoader = true;
        
        addProductDefaults({ 
            sObjectApiNames: this.parentChildRelationApiName, 
            recordId: this.parentRecordId,
            childsObjectApiNames: this.childObjectApiName
        })
        .then(result => {
            // console.log('Product defaults added successfully');
            if (result && result.length > 0) {
                this.showToast('Success', result.length + ' product defaults added successfully', 'success');
    
                setTimeout(() => {
                    window.location.reload();
                }, 2500);

                this.prepareColumns({ objectApiName: this.parentChildRelationApiName })
                if(this.recordId == undefined){
                    this.redirectToRecordPage(this.parentRecordId); // Redirect to the record page
                }
            } else {
                this.showToast('Info', 'No product defaults to add', 'info');
            }
        })
        .catch(error => {
            console.error('Error adding product defaults:', error);
            this.showToast('Error', error.body ? error.body.message : 'Unknown error', 'error');
        });
        // this.showLoader = false;
    }

    showToast(mTitle, mMessage, mVariant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: mTitle,
                message: mMessage,
                variant: mVariant
            }),
        )
    }
}