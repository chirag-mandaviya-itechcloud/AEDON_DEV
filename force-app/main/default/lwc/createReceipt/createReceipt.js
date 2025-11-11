import { LightningElement, api, track } from 'lwc';
import fetchBankAccountViewNew from "@salesforce/apex/CreateMatchingRuleController.fetchBankAccountViewNew";
import fetchExistingReceipts from '@salesforce/apex/CreateReceiptController.fetchExistingReceipts';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const columns = [
    {
        label: 'Bank Receipt Name',
        fieldName: 'recordLink',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_self'
        }
    },
    { label: 'Invoice Date', fieldName: 's2p3__Invoice_Date__c' },
    { label: 'Customer Reference', fieldName: 's2p3__Customer_Reference__c' },
    { label: 'Currency', fieldName: 's2p3__Currency__c' },
    { label: 'Gross Amount', fieldName: 's2p3__Gross_Amount__c' }
];

export default class CreateReceipt extends LightningElement {
    @api recordId;
    @track isLoading = false;
    @track bankAccountObj = {};
    @track openNewRecord;
    @track currencyId = '';
    @track isNotBaseCurrency = false;
    @track lookUpWhereCondition = '';
    @track allBankReceiptData = [];
    @track accountSelected = '';
    @track selectedReference;
    @track selectedInvoiceDate;
    @track currencyISOCode;
    @track selectedCurrency;
    @track exchangeRate;

    referenceOptions = [
        { label: 'Rule Name', value: 'Rule Name' },
        { label: 'Bank Code', value: 'Bank Code' },
        { label: 'Bank Description', value: 'Bank Description' }
    ];

    columns = columns;

    connectedCallback() {
        this.loadBankCurrencyData();
        this.getExistingBankReceipts();
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

    getExistingBankReceipts() {
        fetchExistingReceipts({ bankRecordId: this.recordId })
            .then(result => {

                this.allBankReceiptData = result.map(row => ({
                    ...row,
                    recordLink: '/' + row.Id
                }));

            }).catch(error => {
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
                if (result.bankAccountObj.s2p3__Currency__c != null && result.bankAccountObj.s2p3__Currency__c != undefined && result.bankAccountObj.s2p3__Currency__c != '') {
                    this.currencyId = result.bankAccountObj.s2p3__Currency__c;
                    this.createLookupCondition();
                }
                this.currencyISOCode = result.currencyISOCode;
            }).catch(error => {
                this.isLoading = false;
                console.error('Error fetching bank account view:', error);
            });
    }

    createLookupCondition() {
        this.lookUpWhereCondition = ' AND s2p3__Account_Currency__c = ' + '\'' + this.currencyId + '\'';
    }

    handleAccountSelected(event) {
        if (event.detail.length == 0) {
            this.accountSelected = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.accountSelected = event.detail[0].id;
        }
    }

    handleCurrencySelected(event) {
        if (event.detail.length == 0) {
            this.selectedCurrency = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.selectedCurrency = event.detail[0].id;
        }
    }

    handleReferenceChange(event) {
        this.selectedReference = event.detail.value;
    }

    handleInvoiceDateChange(event) {
        this.selectedInvoiceDate = event.target.value;
    }

    handleExchangeRateChange(event) {
        this.exchangeRate = event.target.value;
    }

    handleNewButton(event) {
        this.openNewRecord = true;
    }

    closeModal(event) {
        this.openNewRecord = false;
    }

    handleSave() {
        const isValid = this.validateFields();
        if (!isValid) {
            return;
        }
        this.openNewRecord = false;
    }

    validateFields() {
        if (!this.accountSelected || this.accountSelected.trim() === '') {
            this.showToast('Warning', 'Please fill the Account.', 'warning');
            return false;
        }
        if (!this.selectedInvoiceDate || this.selectedInvoiceDate.trim() === '') {
            this.showToast('Warning', 'Please fill the Invoice Date.', 'warning');
            return false;
        }
        if (!this.selectedReference || this.selectedReference.trim() === '') {
            this.showToast('Warning', 'Please fill the Reference.', 'warning');
            return false;
        }
        if (!this.selectedCurrency || this.selectedCurrency.trim() === '') {
            this.showToast('Warning', 'Please fill the Currency.', 'warning');
            return false;
        }
        if (!this.exchangeRate || this.exchangeRate.trim() === '') {
            this.showToast('Warning', 'Please fill the Exchange Rate.', 'warning');
            return false;
        }
        return true;
    }
}
