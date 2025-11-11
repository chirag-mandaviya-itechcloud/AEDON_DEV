import { LightningElement, api, track } from 'lwc';
import fetchBankAccountViewNew from "@salesforce/apex/CreateMatchingRuleController.fetchBankAccountViewNew";
import getPickListValuesIntoList from "@salesforce/apex/CreateMatchingRuleController.getPickListValuesIntoList";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import fetchExistingRule from "@salesforce/apex/CreateMatchingRuleController.fetchExistingRule";
import saveMatchingRules from "@salesforce/apex/CreateMatchingRuleController.saveMatchingRule";
import { RefreshEvent } from 'lightning/refresh';

const columns = [
    {
        label: 'Bank Matching Rule Name',
        fieldName: 'recordLink',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_self'
        }
    },
    { label: 'Rule Name', fieldName: 's2p3__Rule_Name__c' },
    { label: 'Active', fieldName: 's2p3__Active__c' },
    { label: 'Code Value', fieldName: 's2p3__Code_Value__c'},
    { label: 'Description Value', fieldName: 's2p3__Description_Value__c'},
    { label: 'Amount Value', fieldName: 's2p3__Amount_Value__c'}
];

export default class CreateMatchingRule extends LightningElement {
    @api recordId;
    @track isLoading = false;
    @track openNewRecord;
    @track bankAccountObj = {};
    @track bankReceiptTransactionLine = {};
    @track bankReceiptHeader = {};
    @track isNotBaseCurrency = false;
    @track bankMatchingRule = {};
    @track bankAccountName = {};
    @track currencyISOCode;
    @track isLoading = false;
    @track codeOperatorOptions = [];
    @track alldescriptionOperator = [];
    @track allamountOperator = [];
    @track codeValue;
    @track descValue;
    @track amountValue;
    @track selectedBankAction = '';
    @track header;
    @track accountSelected = '';
    @track currencyId = '';
    @track lookUpWhereCondition='';
    @track selectedReference;
    @track allBankListData = [];
    @track productCondition;
    @track productSelected='';
    @track subLedgerCondition;
    @track taxCondition;
    @track subLedgerSelected;
    @track taxCode;
    @track addAnalysisCode;
    @track analysisCode1;
    @track analysisCode2;
    @track analysisCode2;
    @track analysisCode3;
    @track analysisCode4;
    @track analysisCode5;
    @track analysisCode6;
    @track analysisCode7;
    @track analysisCode8;
    @track analysisCode9;
    @track analysisCode10;
    

    bankOptions = [
        { label: 'Create Bank Receipt', value: 'Create Bank Receipt' },
        { label: 'Create Bank Payment', value: 'Create Bank Payment' }
    ]

    referenceOptions = [
        { label: 'Rule Name', value: 'Rule Name' },
        { label: 'Bank Code', value: 'Bank Code' },
        { label: 'Bank Description', value: 'Bank Description' }
    ];

    columns = columns;

    handleNewButton(event) {
        this.openNewRecord = true;
    }

    closeModal(event) {
        this.openNewRecord = false;
    } 

    connectedCallback() {
        this.bankMatchingRule.s2p3__Active__c = true;
        this.bankMatchingRule.s2p3__Code_Active__c = true;
        this.bankMatchingRule.s2p3__Description_Active__c = true;
        this.bankMatchingRule.s2p3__Amount_Active__c = false;
        this.isLoading = true;
        this.loadBankCurrencyData();
        this.getCodeOperator();
        this.getDescriptionOperator();
        this.getAmountOperator();
        this.getExistingBankRule();
        this.createProductCondition();
    }

    getExistingBankRule() {
        fetchExistingRule({ bankRecordId: this.recordId})
        .then(result => {

            this.allBankListData = result.map(row => ({
                ...row,
                recordLink: '/' + row.Id   
            }));

        }) .catch (error => {
            console.error('Error fetching bank account view:', error);
        });
    }

    loadBankCurrencyData() {
        fetchBankAccountViewNew({ bankRecordId: this.recordId })

        .then(result => {
            this.isLoading = false;
            this.bankAccountObj = result.bankAccountObj;

            if (!result.bankAccountObj.s2p3__Currency__r.s2p3__IsBaseCurrency__c) {
                this.isNotBaseCurrency = true;
            }
            if(result.bankAccountObj.s2p3__Currency__c != null && result.bankAccountObj.s2p3__Currency__c != undefined && result.bankAccountObj.s2p3__Currency__c !='') {
                this.currencyId = result.bankAccountObj.s2p3__Currency__c;
                this.createLookupCondition();
            }
            this.currencyISOCode = result.currencyISOCode;
        }) .catch (error => {
            this.isLoading = false;
            console.error('Error fetching bank account view:', error);
        });
    }

    createLookupCondition(){
        this.lookUpWhereCondition = ' AND s2p3__Account_Currency__c = '+ '\'' +this.currencyId +'\'';
    }

    createProductCondition() {
        this.productCondition = ' AND IsActive = true ';
    }

    createSubLedgerCondition() {
        this.subLedgerCondition = '';
    }

    createTaxCondition() {
        this.taxCondition = ''
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

    getCodeOperator() {
        getPickListValuesIntoList({
            objectType: 's2p3__Bank_Matching_Rule__c',
            selectedField: 's2p3__Code_Operator__c'
        })
        .then(result => {
            this.codeOperatorOptions = result.map(item => ({
                label: item,
                value: item
            }));

            if (result.includes('Contains')) {
                this.bankMatchingRule.s2p3__Code_Operator__c = 'Contains';
            } else {
                this.bankMatchingRule.s2p3__Code_Operator__c = result.length > 0 ? result[0] : null;
            }
        })
        .catch(error => {
            console.error('Error fetching picklist:', error);
        });
    }

    getDescriptionOperator() {
        getPickListValuesIntoList({
            objectType: 's2p3__Bank_Matching_Rule__c',
            selectedField: 's2p3__Description_Operator__c'
        })
        .then(result => {
            this.alldescriptionOperator = result.map(item => ({
                label: item,
                value: item
            }));

            if (result.includes('Contains')) {
                this.bankMatchingRule.s2p3__Description_Operator__c = 'Contains';
            } else {
                this.bankMatchingRule.s2p3__Description_Operator__c = result.length > 0 ? result[0] : null;
            }
        })
        .catch(error => {
            console.error('Error fetching description operator picklist:', error);
        });
    }

    getAmountOperator() {
        getPickListValuesIntoList({
            objectType: 's2p3__Bank_Matching_Rule__c',
            selectedField: 's2p3__Amount_Operator__c'
        })
        .then(result => {
            this.allamountOperator = result.map(item => ({
                label: item,
                value: item
            }));

            if (result.includes('Equal')) {
                this.bankMatchingRule.s2p3__Amount_Operator__c = 'Equal';
            } else {
                this.bankMatchingRule.s2p3__Amount_Operator__c = result.length > 0 ? result[0] : null;
            }
        })
        .catch(error => {
            console.error('Error fetching Amount Operator picklist:', error);
            alert('Callback Failed...');
        });
    }

    checkboxSelectRule(event) {
        this.bankMatchingRule.s2p3__Active__c = event.target.checked;
        console.log('this.bankMatchingRule.s2p3__Active__c=>',JSON.stringify(this.bankMatchingRule.s2p3__Active__c));
    }

    mrRuleNameChanged(event) {
        this.bankMatchingRule.s2p3__Rule_Name__c = event.target.value;
    }

    checkboxSelectCode(event) {
        this.bankMatchingRule.s2p3__Code_Active__c = event.target.checked;
    }

    handleCodeOperatorChange(event) {
        this.bankMatchingRule.s2p3__Code_Operator__c = event.detail.value;
    }

    handleCodeValueChange(event) {
        this.bankMatchingRule.s2p3__Code_Value__c = event.target.value;
    }

    checkboxSelectDescription(event) {
        this.bankMatchingRule.s2p3__Description_Active__c = event.target.checked;
    }

    handleDescOperatorChange(event) {
        this.bankMatchingRule.s2p3__Description_Operator__c = event.detail.value;
    }

    handleDescValueChange(event) {
        this.bankMatchingRule.s2p3__Description_Value__c = event.detail.value;
    }

    checkboxSelectAmount(event) {
        this.bankMatchingRule.s2p3__Amount_Active__c = event.target.checked;
    }

    handleAmountOperatorChange(event) {
        this.bankMatchingRule.s2p3__Amount_Operator__c = event.detail.value;
    }

    handleAmountValueChange(event) {
        this.bankMatchingRule.s2p3__Amount_Value__c = event.detail.value;
    }

    handleBankActionChange(event) {
        this.selectedBankAction = event.detail.value;
        this.header = this.selectedBankAction == 'Create Bank Receipt'? 'Receipt':'Payment';
    }

    handleAccountSelected(event) {
        if (event.detail.length == 0) {
            this.accountSelected = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.accountSelected = event.detail[0].id;
        }
    }

    handleProductSelectedSelected(event) {
        if (event.detail.length == 0) {
            this.productSelected = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.productSelected = event.detail[0].id;
            
        }
    }

    handleSubLedgerSelectedSelected(event) {
        if (event.detail.length == 0) {
            this.subLedgerSelected = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.subLedgerSelected = event.detail[0].id;
            
        }
    }

    handleTaxGroupSelectedSelected(event) {
        if (event.detail.length == 0) {
            this.taxCode = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.taxCode = event.detail[0].id;
            
        }
    }

    handleReferenceChange(event) {
        this.selectedReference = event.detail.value;
    }

    openAnalysis(event) {
        this.addAnalysisCode = true;
    }

    closeAnalysis(event) {
        this.addAnalysisCode = false;
    }

    get parentContainerClass() {
        const base = 'slds-modal__container';
        return this.addAnalysisCode ? `${base} parent-blurred` : base;
    }

    handleAnalysisCodeOne(event){
        if (event.detail.length == 0) {
            this.analysisCode1 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode1 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeTwo(event){
        if (event.detail.length == 0) {
            this.analysisCode2 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode2 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeThree(event){
        if (event.detail.length == 0) {
            this.analysisCode3 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode3 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeFour(event){
        if (event.detail.length == 0) {
            this.analysisCode4 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode4 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeFive(event){
        if (event.detail.length == 0) {
            this.analysisCode5 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode5 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeSix(event){
        if (event.detail.length == 0) {
            this.analysisCode6 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode6 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeSeven(event){
        if (event.detail.length == 0) {
            this.analysisCode7 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode7 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeEight(event){
        if (event.detail.length == 0) {
            this.analysisCode8 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode8 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeNine(event){
        if (event.detail.length == 0) {
            this.analysisCode9 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode9 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleAnalysisCodeTen(event){
        if (event.detail.length == 0) {
            this.analysisCode10 = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.analysisCode10 = event.detail[0].id;
        }
        this.showToast('Success', 'Anlaysis Code Updated Succesfully', 'success');
    }

    handleSave(){
       const isValid = this.validateFields();
       if (!isValid) {
            return;
        }
        this.isLoading = true;
        saveMatchingRules({
            bankMatchingRule : this.bankMatchingRule,
            account : this.accountSelected,
            reference : this.selectedReference,
            product : this.productSelected,
            subLedger : this.subLedgerSelected,
            taxGroup : this.taxCode,
            code1 : this.analysisCode1,
            code2 : this.analysisCode2,
            code3 : this.analysisCode3,
            code4 : this.analysisCode4,
            code5 : this.analysisCode5,
            code6 : this.analysisCode6,
            code7 : this.analysisCode7,
            code8 : this.analysisCode8,
            code9 : this.analysisCode9,
            code10 : this.analysisCode10,
            selectedBankAction : this.selectedBankAction,
            crrId : this.currencyId,
            bankrecordId : this.recordId

        })
        .then(result=>{
            this.isLoading = false;
            this.showToast('Success', 'Record Saved Succesfully', 'success');
            this.openNewRecord = false;
            this.dispatchEvent(new RefreshEvent());
            this.connectedCallback();
        }).catch(error => {
            this.isLoading = false;
            console.error('Error saving Record:', error);
            this.showToast('Error', error.body.message, 'error');
        });
        
    }

    validateFields() {
        if (!this.bankMatchingRule.s2p3__Rule_Name__c || this.bankMatchingRule.s2p3__Rule_Name__c.trim() === '') {
            this.showToast('Warning', 'Please fill the Rule Name.', 'warning');
            return false;
        }

        if (this.bankMatchingRule.s2p3__Code_Active__c && (!this.bankMatchingRule.s2p3__Code_Operator__c || this.bankMatchingRule.s2p3__Code_Operator__c.trim() === '')) {
            this.showToast('Warning', 'Please fill the Operator for Reference field.', 'warning');
            return false;
        }

        if (this.bankMatchingRule.s2p3__Code_Active__c && (!this.bankMatchingRule.s2p3__Code_Value__c || this.bankMatchingRule.s2p3__Code_Value__c .trim() === '')) {
            this.showToast('Warning', 'Please fill the value for Reference field.', 'warning');
            return false;
        }

        if(this.bankMatchingRule.s2p3__Description_Active__c && (!this.bankMatchingRule.s2p3__Description_Operator__c || this.bankMatchingRule.s2p3__Description_Operator__c.trim() === '')) {
            this.showToast('Warning', 'Please fill the Operator for Description field.', 'warning');
            return false;
        }

        if (this.bankMatchingRule.s2p3__Description_Active__c  && (!this.bankMatchingRule.s2p3__Description_Value__c || this.bankMatchingRule.s2p3__Description_Value__c.trim() === '')) {
            this.showToast('Warning', 'Please fill the value for Description field.', 'warning');
            return false;
        }

        if(this.bankMatchingRule.s2p3__Amount_Active__c && (!this.bankMatchingRule.s2p3__Amount_Operator__c || this.bankMatchingRule.s2p3__Amount_Operator__c.trim() === '')) {
            this.showToast('Warning', 'Please fill the Operator for Amount field.', 'warning');
            return false;
        }

        if(this.bankMatchingRule.s2p3__Amount_Active__c && (!this.bankMatchingRule.s2p3__Amount_Value__c || this.bankMatchingRule.s2p3__Amount_Value__c.trim() === '')) {
            this.showToast('Warning', 'Please fill the value for Amount field.', 'warning');
            return false;
        }

        if(!this.selectedBankAction || this.selectedBankAction.trim() === '') {
            this.showToast('Warning', 'Please select the Rule type.', 'warning');
            return false;
        }

        if(!this.accountSelected || this.accountSelected.trim() === '') {
            this.showToast('Warning', 'Please fill the Account.', 'warning');
            return false;
        }

        if(!this.selectedReference || this.selectedReference.trim() === '' ) {
            this.showToast('Warning', 'Please fill the Reference.', 'warning');
            return false;
        }

        if(!this.subLedgerSelected || this.subLedgerSelected.trim() === '') {
            this.showToast('Warning', 'Please fill the Sub-Ledger.', 'warning');
            return false;
        }

        if(!this.taxCode || this.taxCode.trim() === '') {
            this.showToast('Warning', 'Please fill the Tax-Code.', 'warning');
            return false;
        }
        return true;
    }

}