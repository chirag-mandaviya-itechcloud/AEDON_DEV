import { LightningElement, track, api } from 'lwc';
import saveBankFeed from "@salesforce/apex/BankFeedsListController.saveBankFeed";
import getBankFeedList from "@salesforce/apex/BankFeedsListController.getBankFeedList";
import getFilterData from "@salesforce/apex/BankFeedsListController.getFilterData";
import updateStatementBalanceOnBankAccount from "@salesforce/apex/BankFeedsListController.updateStatementBalanceOnBankAccount";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { RefreshEvent } from 'lightning/refresh';

const columns = [
    {
        label: 'Statement',
        fieldName: 'recordLink',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_self'
        }
    },
    { label: 'Date', fieldName: 'formattedDate' },
    { label: 'Reference', fieldName: 's2p3__Reference__c' },
    { label: 'Description', fieldName: 's2p3__Description__c' },
    { label: 'Receipts', fieldName: 's2p3__Receipt__c' },
    { label: 'Payments', fieldName: 's2p3__Payment__c' },
    { label: 'Source', fieldName: 's2p3__Source__c' },
    { label: 'Status', fieldName: 's2p3__Status__c' },
    { label: 'Internal Notes', fieldName: 's2p3__Internal_Notes__c' }

];

export default class BankFeedsList extends LightningElement {
    @track DateSet;
    @track Receipt;
    @track Inotes;
    @track Refrence;
    @track Payment;
    @track Description;
    @track openNewRecord = false;
    @api recordId;
    @track isLoading = false;
    @track bankFeedData = [];
    @track pageNumber = 1;
    @track pageSize = 200;
    @track totalPages = 0;
    @track allBankFeedData = [];
    @track openImport = false;
    @track filterData = false;;

    @track selectView = 'All';
    @track fromDate;
    @track toDate;
    @track filReference;
    @track filDescription;
    @track Amount;
    @track filINotes;
    @track defFilter;

    @track filteredObject = {};

    columns = columns;

    viewOptions = [
        {
            label: 'All',
            value: 'All',
        },
        {
            label: 'Reconciled',
            value: 'Reconciled',
        },
        {
            label: 'Unreconciled',
            value: 'Unreconciled',
        }
    ];

    connectedCallback() {
        const today = new Date();
        this.toDate = today.toISOString().split('T')[0];

        today.setDate(today.getDate() - 5);
        this.fromDate = today.toISOString().split('T')[0];

        this.filteredObject = {
            selectView: 'All',
            fromDate: this.fromDate, // yyyy-mm-dd
            toDate: this.toDate,
        };
        console.log('Default Filter =>', JSON.stringify(this.filteredObject));
        this.defFilter = this.filteredObject;

        this.getBankFeedData();
        this.updateStatementBalance();
    }

    updateStatementBalance() {
        updateStatementBalanceOnBankAccount({ bankId: this.recordId })
            .then(() => {
                console.log('Bank statement balance update initiated.');
            })
            .catch(error => {
                console.error('Error updating bank statement balance:', error);
            });
    }

    handleViewChange(event) {
        this.selectView = event.detail.value;
        //this.handleInputChange(event);
    }

    handleFromDateChange(event) {
        this.fromDate = event.detail.value;
        //this.handleInputChange(event);
    }

    handleToDateChange(event) {
        this.toDate = event.detail.value;
        //this.handleInputChange(event);
    }

    handlefilRefChange(event) {
        this.filReference = event.detail.value;
        //this.handleInputChange(event);
    }

    handlefilDescChange(event) {
        this.filDescription = event.detail.value;
        //this.handleInputChange(event);
    }

    handleAmountChange(event) {
        this.Amount = event.detail.value;
        //this.handleInputChange(event);
    }

    handlefilINotesChange(event) {
        this.filINotes = event.detail.value;
        //this.handleInputChange(event);
    }

    handleImport(event) {
        this.openImport = true;
    }

    handleCloseUploader() {
        this.openImport = false;
    }

    handleExport(event) {
        this.generatePDF();
    }

    handleRenew() {

    }

    handleRevoke() {

    }

    generatePDF() {
        const recId = this.recordId;
        const selectedFilter = this.filteredObject;
        const defFilter = this.defFilter;
        const filterClick = this.filterData;
        let url = `/apex/s2p3__BankStatementEXCEL?bankRecordId=${recId}&filterData=${encodeURIComponent(JSON.stringify(selectedFilter))}&defFilter=${encodeURIComponent(JSON.stringify(defFilter))}&filterClick=${filterClick}`;

        window.open(url, '_blank');
    }


    buildSelectedFilter() {
        return {
            selectView: this.selectView || 'All',
            fromDate: this.fromDate,
            toDate: this.toDate,
            ...(this.filReference ? { filReference: this.filReference } : {}),
            ...(this.filDescription ? { filDescription: this.filDescription } : {}),
            ...(this.Amount ? { Amount: this.Amount } : {}),
            ...(this.filINotes ? { filINotes: this.filINotes } : {})
        };
    }

    getBankFeedData() {
        this.isLoading = true;
        getBankFeedList({ recordId: this.recordId })
            .then(result => {

                this.allBankFeedData = result.map(row => ({
                    ...row,
                    recordLink: '/' + row.Id,
                    formattedDate: new Date(row.s2p3__Date__c)
                        .toLocaleDateString('en-GB') // gives dd/mm/yyyy
                        .replace(/\//g, '/')
                }));

                if (this.allBankFeedData.length > 0) {
                    this.totalPages = Math.ceil(this.allBankFeedData.length / this.pageSize);
                    this.pageNumber = 1;
                    this.setPageData();
                } else {
                    this.totalPages = 1;
                    this.pageNumber = 1;
                    this.bankFeedData = [];
                }
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                console.error('Error fetching bank feed:', error);
                this.showToast('Error', error.body.message, 'error');
            });
    }

    handleFilterClick(event) {
        this.filterData = true;
        this.isLoading = true;

        try {
            if (this.Amount) {
                this.validateAmountInput(this.Amount);
            }

            this.filteredObject = this.buildSelectedFilter();

            getFilterData({
                recordId: this.recordId,
                selectView: this.selectView,
                fromDate: this.fromDate,
                toDate: this.toDate,
                filReference: this.filReference,
                filDescription: this.filDescription,
                Amount: this.Amount,
                filINotes: this.filINotes
            })
                .then(result => {
                    this.allBankFeedData = result.map(row => ({
                        ...row,
                        recordLink: '/' + row.Id,
                        formattedDate: new Date(row.s2p3__Date__c)
                            .toLocaleDateString('en-GB') // dd/mm/yyyy
                            .replace(/\//g, '/')
                    }));

                    if (this.allBankFeedData.length > 0) {
                        this.totalPages = Math.ceil(this.allBankFeedData.length / this.pageSize);
                        this.pageNumber = 1;
                        this.setPageData();
                    } else {
                        this.totalPages = 1;
                        this.pageNumber = 1;
                        this.bankFeedData = [];
                    }
                    this.isLoading = false;
                })
                .catch(error => {
                    this.isLoading = false;
                    console.error('Error fetching bank feed:', error);
                    this.showToast('Error', error.body?.message || error.message, 'error');
                });
        } catch (error) {
            this.isLoading = false;
            this.showToast('Validation Error', error.message, 'error');
        }
    }

    validateAmountInput(value) {
        value = value.trim();
        const regex = /^(<|>|=)?\d+(\.\d+)?$/;

        if (!regex.test(value)) {
            throw new Error('Invalid amount format. Use <amount, >amount, =amount, or amount only.');
        }

        return true;
    }

    setPageData() {
        const start = (this.pageNumber - 1) * this.pageSize;
        const end = this.pageNumber * this.pageSize;
        this.bankFeedData = this.allBankFeedData.slice(start, end);
    }

    handleNext() {
        if (this.pageNumber < this.totalPages) {
            this.pageNumber++;
            this.setPageData();
        }
    }

    get isPrevDisabled() {
        return this.pageNumber <= 1;
    }

    get isNextDisabled() {
        return this.pageNumber >= this.totalPages;
    }


    handlePrev() {
        if (this.pageNumber > 1) {
            this.pageNumber--;
            this.setPageData();
        }
    }

    openModal(event) {
        this.openNewRecord = true;
    }

    closeModal(event) {
        this.openNewRecord = false;
    }

    handleSave() {
        if (!this.validateFields()) {
            return; // stop if validation fails
        }
        this.isLoading = true;
        saveBankFeed({ DateSet: this.DateSet, Inotes: this.Inotes, Description: this.Description, Refrence: this.Refrence, Receipt: this.Receipt ? parseFloat(this.Receipt) : null, Payment: this.Payment ? parseFloat(this.Payment) : null, recordId: this.recordId })
            .then(result => {
                this.isLoading = false;
                this.showToast('Success', 'Bank feed record created successfully', 'success');
                this.openNewRecord = false;
                this.dispatchEvent(new RefreshEvent());
                this.resetFields();
            })
            .catch(error => {
                this.isLoading = false;
                console.log('error=>', error);
                this.showToast('Error', error.body.message, 'error');
            });
    }

    resetFields() {
        this.DateSet = null;
        this.Description = '';
        this.Refrence = '';
        this.Receipt = null;
        this.Payment = null;
        this.Inotes = '';
    }

    handleSaveNew() {
        if (!this.validateFields()) {
            return;
        }
        this.isLoading = true;
        saveBankFeed({ DateSet: this.DateSet, Inotes: this.Inotes, Description: this.Description, Refrence: this.Refrence, Receipt: this.Receipt ? parseFloat(this.Receipt) : null, Payment: this.Payment ? parseFloat(this.Payment) : null, recordId: this.recordId })
            .then(result => {
                this.isLoading = false;
                this.showToast('Success', 'Bank feed record created successfully', 'success');
                this.resetFields();
            })
            .catch(error => {
                this.isLoading = false;
                console.log('error=>', error);
                this.showToast('Error', error.body.message, 'error');
            });
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

    DateChange(event) {
        this.DateSet = event.detail.value;
    }

    DescChange(event) {
        this.Description = event.detail.value;
    }

    RefChange(event) {
        this.Refrence = event.detail.value;
    }

    RecChange(event) {
        this.Receipt = event.detail.value;
    }

    PayChange(event) {
        this.Payment = event.detail.value;
    }

    NotesChange(event) {
        this.Inotes = event.detail.value;
    }

    validateFields() {
        let allValid = true;

        this.template.querySelectorAll('lightning-input').forEach(input => {
            if (!input.reportValidity()) {
                allValid = false;
            }
        });

        if (!this.DateSet || !this.Description || !this.Refrence) {
            this.showToast('Error', 'Please fill all required fields.', 'error');
            allValid = false;
        }

        const hasReceipt = this.Receipt && parseFloat(this.Receipt) > 0;
        const hasPayment = this.Payment && parseFloat(this.Payment) > 0;

        if (hasReceipt && hasPayment) {
            this.showToast('Error', 'Only one field allowed: either Receipt or Payment.', 'error');
            allValid = false;
        }
        return allValid;
    }


}
