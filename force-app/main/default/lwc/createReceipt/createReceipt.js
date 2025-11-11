import { LightningElement, api, track } from 'lwc';
import fetchExistingReceipts from '@salesforce/apex/CreateReceiptController.fetchExistingReceipts'

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
    @track openNewRecord;
    @track allBankReceiptData = [];

    columns = columns;

    connectedCallback() {
        this.getExistingBankReceipts();
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

    handleNewButton(event) {
        this.openNewRecord = true;
    }

    closeModal(event) {
        this.openNewRecord = false;
    }

    handleSave() {
        this.openNewRecord = false;
    }
}
