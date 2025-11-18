import { LightningElement, api, wire, track } from 'lwc';
import getBankFeeds from '@salesforce/apex/BankReconciliationController.getBankFeeds';
import getMatchingTransactions from '@salesforce/apex/BankReconciliationController.getMatchingTransactions';
import createSPOA from '@salesforce/apex/BankReconciliationController.createSPOA';
import reconcileTransactions from '@salesforce/apex/BankReconciliationController.reconcileTransactions';
import autoMatchTransactions from '@salesforce/apex/BankReconciliationController.autoMatchTransactions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import createBRFXGainLoss from '@salesforce/apex/BankReconciliationController.createBRFXGainLoss';

export default class ReconcileTable extends NavigationMixin(LightningElement) {
    @api recordId;
    @track bankFeeds = [];
    @track matchingTransactions = [];
    @track selectedBankFeedIds = new Set();
    @track allMatchingTransactions = [];
    @track error;
    @track isModalOpen = false;
    @track isLoading = false;
    @track isMatching = false;
    @track bankFeedDetails = {};
    @track totalSelectedAmount = 0;
    wiredBankFeeds;
    @track differenceAmount = 0;
    @track modalkaspinner = false;


    @track allBankFeeds = [];
    @track currentPage = 1;
    @track pageSize = 200;
    @track totalPages = 0;
    @track filReference;
    @track selectView;
    @track filDescription;
    @track MinAmount;
    @track internalrecordId;
    @track selectedButton;

    @track internalAccount;
    @track transactionReference;
    @track reference;
    @track Amount;
    @track transactionName;
    @track selectedTransactionIds = new Set();
    viewOptions = [
        {
            label: 'All',
            value: 'All',
        },
        {
            label: 'Matched',
            value: 'Matched',
        },
        {
            label: 'UnMatched',
            value: 'UnMatched',
        }
    ];

    internalPageSize = 10;       // Records per page Internal
    internalPageNumber = 1;      // Current page number Internal
    internalTotalRecords = 0;    // Total records fetched Internal
    internalTotalPages = 0;      // Total pages Internal

    transactionTypeOption = [
        { label: 'Cash In', value: 'Cash In' },
        { label: 'Receipt', value: 'Receipt' },
        { label: 'Cash Out', value: 'Cash Out' },
        { label: 'Payment', value: 'Payment' }
    ]

    connectedCallback() {
        const today = new Date();
        this.toDate = today.toISOString().split('T')[0];

        today.setDate(today.getDate() - 5);
        this.fromDate = today.toISOString().split('T')[0];

        this.fetchBankFeeds();
    }


    handleDateChange(event) {
        const fieldName = event.target.dataset.field;
        if (fieldName === "fromDate") {
            this.fromDate = event.target.value;
        } else if (fieldName === "toDate") {
            this.toDate = event.target.value;
        }
    }

    applyFilters() {
        this.fetchBankFeeds();
    }

    fetchBankFeeds() {
        this.isLoading = true;
        getBankFeeds({ bankId: this.recordId, listView: this.selectView, fromDate: this.fromDate, toDate: this.toDate, filReference: this.filReference, description: this.filDescription, amount: this.MinAmount })
            .then((data) => {
                this.allBankFeeds = data.map(feed => ({
                    ...feed,
                    isDisabled: !feed.s2p3__Auto_Match__c,
                    formattedDate: new Date(feed.s2p3__Date__c)
                        .toLocaleDateString('en-GB')
                        .replace(/\//g, '/'),
                }));
                this.totalPages = Math.ceil(this.allBankFeeds.length / this.pageSize);
                this.currentPage = 1;
                this.setPageData();
            })
            .catch((error) => {
                console.error('Error fetching bank feeds:', error);
                //this.showToast('Error', 'Error fetching bank feeds.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    setPageData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = this.pageSize * this.currentPage;
        this.bankFeeds = this.allBankFeeds.slice(start, end);
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.setPageData();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.setPageData();
        }
    }

    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    get isPreviousDisabled() {
        return this.currentPage <= 1;
    }

    /*fetchBankFeeds() {
        this.isLoading = true;
        refreshApex(this.wiredBankFeeds)
            .finally(() => {
                this.isLoading = false;
                this.currentPage = 1;
                this.setPageData();
            });
    }*/

    navigateToRecord(event) {
        const recId = event.currentTarget.dataset.id;

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recId,
                actionName: 'view'
            }
        });
    }



    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    isCheckboxDisabled(record) {
        return !record.s2p3__Auto_Match__c;  // Disable only when it's false
    }

    handleMatchToPayment(event) {
        this.internalrecordId = event.target.dataset.id;
        this.fetchMatching();
    }

    fetchMatching() {
        const selectedBankFeed = this.bankFeeds.find(feed => feed.Id === this.internalrecordId);
        if (!selectedBankFeed) return;

        this.bankFeedDetails = {
            ...selectedBankFeed,
            formattedDate: new Date(selectedBankFeed.s2p3__Date__c)
                .toLocaleDateString('en-GB')
                .replace(/\//g, '/'),
            amount: selectedBankFeed.s2p3__Receipt__c > 0
                ? selectedBankFeed.s2p3__Receipt__c
                : selectedBankFeed.s2p3__Payment__c
        };

        this.isMatching = true;

        getMatchingTransactions({
            bankFeedId: this.internalrecordId,
            accountId: this.internalAccount,
            fromDate: this.fromDate,
            toDate: this.toDate,
            transactionType: this.transactionReference,
            transactionName: this.transactionName,
            reference: this.reference,
            amount: this.Amount
        })
            .then(data => {
                this.allMatchingTransactions = data.map(transaction => ({
                    ...transaction,
                    formattedDate: new Date(transaction.s2p3__Date__c)
                        .toLocaleDateString('en-GB')
                        .replace(/\//g, '/'),
                    amount: selectedBankFeed.s2p3__Receipt__c > 0
                        ? transaction.s2p3__Movement__c
                        : transaction.s2p3__Reverse_Movement__c,
                    accountName: transaction.s2p3__Account__c != undefined && transaction.s2p3__Account__c != '' ?
                        transaction.s2p3__Account__r.Name : ''
                }));

                // Initialize pagination
                this.internalTotalRecords = this.allMatchingTransactions.length;
                this.internalTotalPages = Math.ceil(this.internalTotalRecords / this.internalPageSize);
                this.internalPageNumber = 1;

                this.updatePaginatedData();
                this.isModalOpen = true;
            })
            .catch(error => {
                console.error('Error fetching matching transactions:', error);
                this.matchingTransactions = [];
            })
            .finally(() => {
                this.isMatching = false;
            });
    }

    updatePaginatedData() {
        const startIndex = (this.internalPageNumber - 1) * this.internalPageSize;
        const endIndex = startIndex + this.internalPageSize;

        // Add a "selected" flag for rendering checkboxes
        this.matchingTransactions = this.allMatchingTransactions.slice(startIndex, endIndex).map(txn => ({
            ...txn,
            isSelected: this.selectedTransactionIds.has(txn.Id)
        }));
    }

    handleNextPage() {
        if (this.internalPageNumber < this.internalTotalPages) {
            this.internalPageNumber++;
            this.updatePaginatedData();
        }
    }

    handlePreviousPage() {
        if (this.internalPageNumber > 1) {
            this.internalPageNumber--;
            this.updatePaginatedData();
        }
    }

    get isPrevDisabled() {
        return Number(this.internalPageNumber) <= 1;
    }
    get isNextDisabled() {
        const total = Number(this.internalTotalPages) || 0;
        return total <= 1 || Number(this.internalPageNumber) >= total;
    }


    handleCheckboxChange(event) {
        try {
            const recordId = event.target.dataset.id;
            const isChecked = event.target.checked;
            const isTransaction = this.isModalOpen;

            if (isTransaction) {
                if (!this.selectedTransactionIds) {
                    this.selectedTransactionIds = new Set();
                }

                if (isChecked) {
                    this.selectedTransactionIds.add(recordId);
                } else {
                    this.selectedTransactionIds.delete(recordId);
                }

                this.totalSelectedAmount = this.getTotalSelectedAmount();
                this.differenceAmount =
                    (this.bankFeedDetails?.s2p3__Receipt__c || 0) - this.totalSelectedAmount;

            } else {
                const index = this.bankFeeds.findIndex(feed => feed.Id === recordId);
                if (index !== -1) {
                    const feed = { ...this.bankFeeds[index] };
                    if (!feed.s2p3__Auto_Match__c && isChecked) return;
                    feed.s2p3__Auto_Match__c = isChecked;
                    this.bankFeeds[index] = feed;
                }

                if (isChecked) {
                    this.selectedBankFeedIds.add(recordId);
                } else {
                    this.selectedBankFeedIds.delete(recordId);
                }
            }
        } catch (err) {
            // Catch and log so we can see what’s really failing
            console.error('handleCheckboxChange error →', err);
            this.showToast('Error', err.message || 'Unexpected checkbox error', 'error');
        }
    }



    get differenceStyle() {
        if (this.differenceAmount < 0) {
            return 'color: #FF91A4; font-weight: 700;';
        } else if (this.differenceAmount === 0) {
            return 'color: #00CC99; font-weight: 700;';
        } else {
            return 'color: black; font-weight: 700;';
        }
    }


    closeModal() {
        this.isModalOpen = false;

        if (this.selectedTransactionIds) this.selectedTransactionIds.clear();
        this.totalSelectedAmount = 0;
        this.differenceAmount = 0;

        this.matchingTransactions = [];
        this.allMatchingTransactions = [];
        this.internalTotalRecords = 0;
        this.internalTotalPages = 0;
        this.internalPageNumber = 1;


        this.internalAccount = null;
        this.transactionReference = null;
        this.transactionName = null;
        this.reference = null;
        this.Amount = null;
    }


    handleReconcile() {
        if (this.selectedButton == 'POA') {
            this.handlePOAClicked();
        } else if (this.selectedButton == 'FX') {
            this.handleFXClicked();
        } else {
            if (this.selectedBankFeedIds.size === 0) {
                this.showToast('Error', 'Please select at least one Ledger Entry to reconcile.', 'error');
                return;
            }
            const bankFeedId = this.bankFeedDetails.Id;
            this.isLoading = true;

            reconcileTransactions({ ledgerEntryIds: Array.from(this.selectedBankFeedIds), bankFeedId })
                .then(() => {
                    this.showToast('Success', 'Transactions reconciled.', 'success');
                    this.isModalOpen = false;
                    return; //refreshApex(this.wiredBankFeeds);
                })
                .catch(error => {
                    console.error('Error reconciling transactions:', error);
                    this.showToast('Error', 'Failed to reconcile transactions.', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
    }

    /*refreshData() {
        return refreshApex(this.wiredBankFeeds);
    }*/

    get isReconcileDisabled() {
        const amountMismatch = Math.abs(this.totalSelectedAmount - this.bankFeedDetails.amount) > 0.01;

        const diffNotZeroButButtonsUnlocked = this.differenceAmount !== 0 && this.selectedButton != null

        if (this.differenceAmount != 0) {
            return !diffNotZeroButButtonsUnlocked;
        } else {
            return amountMismatch;
        }
    }


    getTotalSelectedAmount() {
        return Array.from(this.selectedTransactionIds)
            .map(id => this.allMatchingTransactions.find(txn => txn.Id === id)?.amount || 0)
            .reduce((sum, amount) => sum + amount, 0);
    }


    // ✅ Auto Match Transactions Function
    handleAutoMatch() {
        this.isLoading = true;

        autoMatchTransactions({ bankId: this.recordId, fromDate: this.fromDate, toDate: this.toDate })
            .then(() => {
                this.showToast('Success', 'Auto-matching completed successfully.', 'success');
                return; //refreshApex(this.wiredBankFeeds);
            })
            .catch(error => {
                console.error('Error during auto-matching:', error);
                this.showToast('Error', 'Failed to auto-match transactions.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /*bulkReconcile() {
        console.log('Selected Ledger Entry IDs:', JSON.stringify(Array.from(this.selectedBankFeedIds)));

        // Group Ledger Entry IDs by Bank Feed ID
        const bankFeedMap = new Map();

        console.log('bankFeeds: ',JSON.stringify(this.bankFeeds));

        this.bankFeeds.forEach(feed => {
            if (this.selectedBankFeedIds.has(feed.Id)) { // ✅ Check if the Ledger Entry ID is selected
                const bankFeedId = feed.Id; // ✅ Correctly fetch Bank Feed ID
                const ledgerEntryId = feed.s2p3__Matched_Ledger_Entry__c; // ✅ This is the actual Ledger Entry ID

                if (!bankFeedMap.has(bankFeedId)) {
                    bankFeedMap.set(bankFeedId, []);
                }
                bankFeedMap.get(bankFeedId).push(ledgerEntryId); // ✅ Store Ledger Entry IDs under correct Bank Feed
            }
        });

        if (bankFeedMap.size === 0) {
            this.showToast('Error', 'No transactions selected for reconciliation.', 'error');
            return;
        }

        this.isLoading = true;
        const reconcilePromises = [];

        bankFeedMap.forEach((ledgerEntryIds, bankFeedId) => {
            reconcilePromises.push(
                reconcileTransactions({ ledgerEntryIds, bankFeedId })
                    .then(() => {
                        console.log(`Reconciled Bank Feed: ${bankFeedId} with Ledger Entries:`, ledgerEntryIds);
                    })
                    .catch(error => {
                        console.error(`Error reconciling ${bankFeedId}:`, error);
                    })
            );
        });

        Promise.all(reconcilePromises)
            .then(() => {
                this.showToast('Success', 'Transactions reconciled successfully!', 'success');
                return refreshApex(this.wiredBankFeeds);
            })
            .catch(() => {
                this.showToast('Error', 'Reconciliation failed.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }*/

    bulkReconcile() {
        console.log('Selected Bank Feed IDs:', JSON.stringify(Array.from(this.selectedBankFeedIds)));

        const ledgerEntryMap = new Map();

        this.bankFeeds.forEach(feed => {
            if (this.selectedBankFeedIds.has(feed.Id)) {
                // Allow Ledger Entry ID to be null (if not matched)
                ledgerEntryMap.set(feed.Id, feed.s2p3__Matched_Ledger_Entry__c || null);
            }
        });

        if (ledgerEntryMap.size === 0) {
            this.showToast('Error', 'No transactions selected for reconciliation.', 'error');
            return;
        }

        this.isLoading = true;

        // Call Batch Apex
        reconcileTransactions({ ledgerEntryMap: Object.fromEntries(ledgerEntryMap) })
            .then(() => {
                this.showToast('Success', 'Reconciliation batch started successfully!', 'success');
            })
            .catch(error => {
                console.error('Batch Reconciliation failed:', error);
                this.showToast('Error', 'Batch Reconciliation failed.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }


    refreshData() {
        fetchUnreconciledBankFeeds({ filters: this.filters })
            .then(data => {
                this.records = data;
                this.selectedBankFeedIds.clear(); // Ensure it's reset before populating

                data.forEach(record => {
                    if (record.s2p3__Auto_Match__c) {
                        this.selectedBankFeedIds.add(record.Id);
                    }
                });

                console.log('Auto-selected IDs:', Array.from(this.selectedBankFeedIds)); // Debugging
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleFromDateChange(event) {
        this.fromDate = event.detail.value;
    }

    handleToDateChange(event) {
        this.toDate = event.detail.value;
    }

    handleViewChange(event) {
        this.selectView = event.detail.value;
    }

    handlefilRefChange(event) {
        this.filReference = event.detail.value;
    }

    handlefilDescChange(event) {
        this.filDescription = event.detail.value;
    }

    handleAmountChange(event) {
        this.MinAmount = event.detail.value;
    }

    filterInternalData(event) {
        this.fetchMatching();
    }

    handleAccountSelected(event) {
        if (event.detail.length == 0) {
            this.internalAccount = null;
        }
        if (event.detail.length > 0 && event.detail[0].id != undefined && event.detail[0].id != null) {
            this.internalAccount = event.detail[0].id;

        }
    }

    internalDateChanged(event) {
        this.fromDate = event.detail.value;
    }

    handleTransctionTypeChange(event) {
        this.transactionReference = event.detail.value;
    }

    transactionNameChanged(event) {
        this.transactionName = event.detail.value;
    }

    refChanged(event) {
        this.reference = event.detail.value;
    }

    handleAmountChange(event) {
        this.Amount = event.detail.value;
    }

    handleClick(event) {
        const clickedName = event.target.name;
        if (this.selectedButton === clickedName) {
            this.selectedButton = null;
        } else {
            this.selectedButton = clickedName;
        }
    }

    handlePOAClicked() {
        if (this.internalAccount == undefined || this.internalAccount == '') {
            this.showToast('Error', 'Please select Account', 'error');
            return;
        }
        this.modalkaspinner = true;
        var reference = this.bankFeedDetails.s2p3__Reference__c + ' ' + this.bankFeedDetails.s2p3__Description__c;
        var accountChoosen = this.internalAccount;
        const parts = this.bankFeedDetails.formattedDate.split('/');
        var dateSelected = `${parts[2]}-${parts[1]}-${parts[0]}`;
        var unitPrice = this.differenceAmount;
        createSPOA({ bankId: this.recordId, reference: reference, account: accountChoosen, selectedDate: dateSelected, unitPrice: unitPrice })
            .then(data => {
                this.modalkaspinner = false;
                this.showToast('Success', 'Sales payment created and posted successfully', 'success');
            })
            .catch(error => {
                this.modalkaspinner = false;
                this.showToast('Error', error.body.message, 'error');
            })
    }

    handleFXClicked() {
        this.modalkaspinner = true;
        var reference = this.bankFeedDetails.s2p3__Reference__c + ' ' + this.bankFeedDetails.s2p3__Description__c;
        const parts = this.bankFeedDetails.formattedDate.split('/');
        var dateSelected = `${parts[2]}-${parts[1]}-${parts[0]}`;
        var unitPrice = this.differenceAmount;

        createBRFXGainLoss({ bankId: this.recordId, reference: reference, selectedDate: dateSelected, unitPrice: unitPrice })
            .then(data => {
                this.modalkaspinner = false;
                this.showToast('Success', 'FX Gain/Loss created and posted successfully', 'success');
            })
            .catch(error => {
                this.modalkaspinner = false;
                this.showToast('Error', error.body.message, 'error');
            });

    }

    get isPaymentOnAccountDisabled() {
        return this.isButtonDisabled('POA');
    }

    get isFxGainLossDisabled() {
        return this.isButtonDisabled('FX');
    }

    get isBankChargesDisabled() {
        return this.isButtonDisabled('BC');
    }

    get isWriteOffDisabled() {
        return this.isButtonDisabled('WO');
    }

    isButtonDisabled(buttonKey) {
        if (this.differenceAmount == 0) {
            this.selectedButton = null;
            this.buttonVariant('No one');
            return true;
        }
        if (this.selectedTransactionIds.size == 0) {
            return true;
        }
        if (this.selectedButton) {
            return this.selectedButton !== buttonKey;
        }
        if (this.differenceAmount > 0) {
            return !(buttonKey === 'POA' || buttonKey === 'FX');
        } else if (this.differenceAmount < 0) {
            return buttonKey === 'POA';
        }
        return true;
    }

    get paymentOnAccountVariant() {
        return this.buttonVariant('POA');
    }

    get fxGainLossVariant() {
        return this.buttonVariant('FX');
    }

    get bankChargesVariant() {
        return this.buttonVariant('BC');
    }

    get writeOffVariant() {
        return this.buttonVariant('WO');
    }

    buttonVariant(buttonKey) {
        return this.selectedButton === buttonKey ? 'success' : 'neutral';
    }
}
