public with sharing class BankReconciliationController {
    @AuraEnabled(cacheable=true)
    public static List<s2p3__Bank_Feed__c> getBankFeeds(Id bankId, String listView, Date fromDate, Date toDate, String filReference, String description, String amount) {

        List<Bank_Feed__c> bankFeed = new List<Bank_Feed__c>();
        String qryBuild = 'SELECT Id, Name, Receipt__c, Payment__c, Date__c, Status__c, Reference__c, Description__c, s2p3__Auto_Match__c,  s2p3__Auto_Matched_To__c, s2p3__Matched_Ledger_Entry__c,s2p3__Internal_Notes__c FROM Bank_Feed__c WHERE Bank__c = :bankId' ;
        if (fromDate != null) {
            fromDate = (Date)fromDate;
            qryBuild += ' AND Date__c >=:fromDate ';
        }
        if (toDate != null) {
            toDate = (Date)toDate;
            qryBuild += ' AND Date__c <=:toDate ';
        }
        if (String.isNotBlank(filReference)) {
            qryBuild += ' AND Reference__c Like' + '\'%' +filReference + '%\''  ;
        }
        if (String.isNotBlank(description)) {
            qryBuild += ' AND Description__c Like' + '\'%' +description + '%\'';
        }
        if (listView == 'UnMatched') {
            qryBuild += ' AND Auto_Match__c = false';
        }
        if (listView == 'Matched') {
            qryBuild += ' AND Auto_Match__c = true';
        }
        if (String.isNotBlank(amount)) {

            amount = Amount.trim();
            String operator = '';
            Decimal amountValue;

            if (Amount.startsWith('<') || Amount.startsWith('>') || Amount.startsWith('=')) {
                operator = Amount.substring(0, 1);
                amountValue = Decimal.valueOf(Amount.substring(1));
            } else {
                operator = '=';
                amountValue = Decimal.valueOf(Amount);
            }
            qryBuild += ' AND (Receipt__c ' + operator + ' :amountValue OR Payment__c ' + operator + ' :amountValue)';
        }
        qryBuild += ' WITH SECURITY_ENFORCED LIMIT 2000';
        System.debug('qryBuild=>'+qryBuild);
        bankFeed = Database.query(qryBuild);
        return bankFeed;
    }

    @AuraEnabled
    public static List<s2p3__Ledger_Entry__c> getMatchingTransactions(String bankFeedId, String accountId, Date fromDate, String transactionType, String transactionName, String reference, String amount) {
        try {
            Bank_Feed__c bankFeed = [Select Id, Name, s2p3__Matched_Ledger_Entry__c, Reference__c, Description__c, Bank__r.Reconciliation_Description_Filter__c, s2p3__Bank_Subledger__c, Receipt__c, Payment__c from Bank_Feed__c where Id =: bankFeedId WITH SECURITY_ENFORCED];
            List<s2p3__Ledger_Entry__c> ledgerEntryList = new List<s2p3__Ledger_Entry__c>();

            if(bankFeed.Receipt__c > 0){
                String query = 'SELECT Id, s2p3__Account__c, s2p3__Account__r.Name, s2p3__Account__r.AccountNumber, Name, s2p3__Date__c, s2p3__Reconciliation_Status__c, s2p3__Reference_Name__c,Nature_Of_Transaction__c,';
                query+='Movement__c, Reverse_Movement__c,s2p3__Customer_Reference__c, s2p3__Payment_Reference__c FROM s2p3__Ledger_Entry__c ';
                query+=' WHERE Sub_Ledger__c = '+ '\'' +bankFeed.s2p3__Bank_Subledger__c +'\'';
                system.debug('accountId=>'+accountId);
                if(String.isNotBlank(accountId)) {
                    query +=' AND s2p3__Account__c =:accountId ';
                }
                if (fromDate != null) {
                    fromDate = (Date)fromDate;
                    query += ' AND Date__c >=:fromDate ';
                }
                if(String.isNotBlank(transactionType)) {
                    query+=' AND Nature_Of_Transaction__c =:transactionType ';
                }
                if(String.isBlank(transactionType)) {
                    query+= ' AND ( Nature_Of_Transaction__c = \'Cash In\' OR Nature_Of_Transaction__c = \'Receipt\')';
                }
                if(String.isNotBlank(transactionName)) {
                    query+= ' AND Reference_Name__c Like' + '\'%' +transactionName + '%\'';
                }
                if (String.isNotBlank(reference)) {
                    String likeRef = '%' + String.escapeSingleQuotes(reference) + '%';
                    query += ' AND (Customer_Reference__c LIKE \'' + likeRef + '\' ' +
                        'OR Payment_Reference__c LIKE \'' + likeRef + '\')';
                }

                if (String.isNotBlank(amount)) {

                    amount = Amount.trim();
                    String operator = '';
                    Decimal amountValue;

                    if (Amount.startsWith('<') || Amount.startsWith('>') || Amount.startsWith('=')) {
                        operator = Amount.substring(0, 1);
                        amountValue = Decimal.valueOf(Amount.substring(1));
                    } else {
                        operator = '=';
                        amountValue = Decimal.valueOf(Amount);
                    }
                    query += ' AND (s2p3__Movement__c ' + operator + ' :amountValue)';
                }
                query+= ' AND s2p3__Reconciliation_Status__c = \'Unreconciled\' AND Movement__c <='+ bankFeed.Receipt__c+' WITH SECURITY_ENFORCED ORDER BY s2p3__Date__c DESC LIMIT 20';

                System.debug('query=>'+query);
                ledgerEntryList = Database.query(query);
            }
            if(bankFeed.Payment__c > 0) {
                String query = 'SELECT Id, s2p3__Account__c, s2p3__Account__r.Name, s2p3__Account__r.AccountNumber, Name, s2p3__Date__c, s2p3__Reconciliation_Status__c, s2p3__Reference_Name__c,Nature_Of_Transaction__c,';
                query+='Movement__c, Reverse_Movement__c,s2p3__Customer_Reference__c, s2p3__Payment_Reference__c FROM s2p3__Ledger_Entry__c ';
                query+=' WHERE Sub_Ledger__c = '+ '\'' +bankFeed.s2p3__Bank_Subledger__c +'\'';

                system.debug('accountId=>'+accountId);
                if(String.isNotBlank(accountId)) {
                    query +=' AND s2p3__Account__c =:accountId ';
                }
                if (fromDate != null) {
                    fromDate = (Date)fromDate;
                    query += ' AND Date__c >=:fromDate ';
                }
                if(String.isNotBlank(transactionType)) {
                    query+=' AND Nature_Of_Transaction__c =:transactionType ';
                }
                if(String.isBlank(transactionType)) {
                    query+= ' AND ( Nature_Of_Transaction__c = \'Cash Out\' OR Nature_Of_Transaction__c = \'Payment\')';
                }
                if(String.isNotBlank(transactionName)) {
                    query+= ' AND Reference_Name__c =:transactionName';
                }
                if(String.isNotBlank(reference)) {
                    query+= ' AND (Customer_Reference__c =:reference OR Payment_Reference__c =:reference) ';
                }
                if (String.isNotBlank(amount)) {

                    amount = Amount.trim();
                    String operator = '';
                    Decimal amountValue;

                    if (Amount.startsWith('<') || Amount.startsWith('>') || Amount.startsWith('=')) {
                        operator = Amount.substring(0, 1);
                        amountValue = Decimal.valueOf(Amount.substring(1));
                    } else {
                        operator = '=';
                        amountValue = Decimal.valueOf(Amount);
                    }
                    query += ' AND (Reverse_Movement__c ' + operator + ' :amountValue)';
                }

                query+= ' AND s2p3__Reconciliation_Status__c = \'Unreconciled\' AND Reverse_Movement__c <='+ bankFeed.Payment__c+' WITH SECURITY_ENFORCED ORDER BY s2p3__Date__c DESC LIMIT 20';
                System.debug('query=>'+query);
                ledgerEntryList =Database.query(query);
            }

            if (ledgerEntryList.size() == 21) {
                throw new AuraHandledException('Too many transactions. Narrow down the date range.');
            }

            return ledgerEntryList;
        } catch (Exception e) {
            System.debug('Error fetching matching transactions: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void reconcileTransactions(Map<Id, Id> ledgerEntryMap) {
         if (ledgerEntryMap.isEmpty()) {
            throw new AuraHandledException('No Bank Feeds selected for reconciliation.');
        }

        // Start batch process (200 records per batch)
        Database.executeBatch(new BankFeedBulkReconciliationBatch(ledgerEntryMap), 200);
        /*try {
            List<s2p3__Ledger_Entry__c> ledgerEntryList = [SELECT Id, s2p3__Reconciliation_Status__c FROM s2p3__Ledger_Entry__c WHERE Id IN :ledgerEntryIds WITH SECURITY_ENFORCED];

            for (s2p3__Ledger_Entry__c entry : ledgerEntryList) {
                entry.s2p3__Reconciliation_Status__c = 'Reconciled';
                entry.s2p3__Bank_Feed__c = bankFeedId;
            }
            ledgerEntryList = DBOpsUtils.s2p3Update(ledgerEntryList);

            List<Bank_Feed__c> bankFeedList = [Select Id, Status__c, s2p3__Matched_Ledger_Entry__c from Bank_Feed__c where Id =: bankFeedId WITH SECURITY_ENFORCED];
            if(bankFeedList.size() > 0){
                bankFeedList[0].s2p3__Status__c = 'Reconciled';
            }

            bankFeedList = DBOpsUtils.s2p3Update(bankFeedList);

        } catch (Exception e) {
            throw new AuraHandledException('Error reconciling transactions: ' + e.getMessage());
        }*/
    }

    @AuraEnabled
    public static void unreconcileBankFeed(List<Id> selectedBankFeedIds) {
        List<Bank_Feed__c> bankFeedList = [SELECT Id, s2p3__Matched_Ledger_Entry__c, Status__c FROM Bank_Feed__c WHERE Id IN :selectedBankFeedIds WITH SECURITY_ENFORCED];
        if(bankFeedList.size() > 0){
            bankFeedList[0].s2p3__Status__c = 'Unreconciled';
        }

        List<Ledger_Entry__c> ledgerEntryList = [select Id, Reconciliation_Status__c from Ledger_Entry__c where Bank_Feed__c IN: selectedBankFeedIds WITH SECURITY_ENFORCED];
        for (s2p3__Ledger_Entry__c entry : ledgerEntryList) {
            entry.s2p3__Reconciliation_Status__c = 'Unreconciled';
        }
        bankFeedList = DBOpsUtils.s2p3Update(bankFeedList);
        ledgerEntryList = DBOpsUtils.s2p3Update(ledgerEntryList);
    }

    @AuraEnabled
    public static void autoMatchTransactions(Id bankId, Date fromDate, Date toDate) {
        BankFeedAutoMatchBatch batch = new BankFeedAutoMatchBatch(bankId, fromDate, toDate);
		Database.executeBatch(batch, 1);

        /*List<Bank_Feed__c> bankFeeds = [
            SELECT Id, s2p3__Receipt__c, s2p3__Payment__c, s2p3__Auto_Match__c, s2p3__Auto_Matched_To__c, s2p3__Bank_Subledger__c, s2p3__Matched_Ledger_Entry__c,
            s2p3__Description__c, s2p3__Bank__r.Reconciliation_Description_Filter__c
            FROM Bank_Feed__c
            WHERE s2p3__Bank__c = :bankId
            AND s2p3__Status__c = 'Unreconciled'
            AND s2p3__Date__c >= :fromDate
            AND s2p3__Date__c <= :toDate
            AND s2p3__Status__c = 'Unreconciled'
        ];

        List<Ledger_Entry__c> ledgerEntries = [
            SELECT Id, Name, s2p3__Movement__c, s2p3__Reverse_Movement__c, s2p3__Payment_Reference__c, Reference_Name__c
            FROM Ledger_Entry__c
            WHERE s2p3__Date__c >= :fromDate
            AND s2p3__Date__c <= :toDate
            AND s2p3__Reconciliation_Status__c = 'Unreconciled'
            AND Sub_Ledger__c = :bankFeeds[0].s2p3__Bank_Subledger__c
        ];

        Set<Id> usedLedgerEntries = new Set<Id>();  // Track matched ledger entries
        List<Bank_Feed__c> bankFeedsToUpdate = new List<Bank_Feed__c>();

        for (Bank_Feed__c bankFeed : bankFeeds) {
            List<Ledger_Entry__c> potentialMatches = new List<Ledger_Entry__c>();

            for (Ledger_Entry__c entry : ledgerEntries) {
                if (usedLedgerEntries.contains(entry.Id)) {
                    continue; // Skip already matched ledger entries
                }

                Decimal expectedAmount = bankFeed.s2p3__Receipt__c > 0
                    ? entry.s2p3__Movement__c   // Always match Movement for receipts
                    : entry.s2p3__Reverse_Movement__c; // Always match Reverse Movement for payments

                Boolean amountMatches = (expectedAmount == (bankFeed.s2p3__Receipt__c > 0 ? bankFeed.s2p3__Receipt__c : bankFeed.s2p3__Payment__c));

                Boolean descriptionMatches = true;
                if (bankFeed.s2p3__Bank__r.Reconciliation_Description_Filter__c) {
                    descriptionMatches = bankFeed.s2p3__Description__c != null &&
                        entry.s2p3__Payment_Reference__c != null &&
                        bankFeed.s2p3__Description__c.contains(entry.s2p3__Payment_Reference__c);
                }

                if (amountMatches && descriptionMatches) {
                    potentialMatches.add(entry);
                }
            }

            system.debug('potentialMatches: '+potentialMatches);

            if (potentialMatches.size() == 1) { // Only update if exactly one match is found
                Ledger_Entry__c matchedEntry = potentialMatches[0];
                bankFeed.s2p3__Auto_Match__c = true;
                bankFeed.s2p3__Auto_Matched_To__c = matchedEntry.Reference_Name__c;
                bankFeed.s2p3__Matched_Ledger_Entry__c = matchedEntry.Id;
                bankFeedsToUpdate.add(bankFeed);
                usedLedgerEntries.add(matchedEntry.Id); // Mark this ledger entry as used
            }
        }

        if (!bankFeedsToUpdate.isEmpty()) {
            update bankFeedsToUpdate;
        }*/
    }

    @AuraEnabled(cacheable=true)
    public static List<Bank_Feed__c> getBankFeedList(Id bankId) {
        return [
            SELECT Id, Name, s2p3__Date__c, s2p3__Reference__c, s2p3__Description__c, s2p3__Receipt__c, s2p3__Payment__c, s2p3__Status__c, s2p3__Auto_Match__c,  s2p3__Auto_Matched_To__c, s2p3__Matched_Ledger_Entry__c
            FROM Bank_Feed__c
            WHERE Bank__c = :bankId
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled
    public Static void createSPOA(String bankId,String reference, String account,String selectedDate, Decimal unitPrice){
        try{
            Bank__c bank = [SELECT Currency__c,Sub_Ledger__c,Tax_Group_for_Payment_on_Account__c FROM Bank__c WHERE Id=:bankId WITH SECURITY_ENFORCED];
            Sales_POA__c spoa = new Sales_POA__c();
            spoa.Customer_reference__c = (reference != null && reference.length() > 25) ? reference.substring(0, 25) : reference;
            spoa.To_Account__c = account;
            spoa.Invoice_Date__c = Date.valueof(selectedDate);
            spoa.Transaction_Currency__c = bank.Currency__c;
            spoa.Transaction_Currency_Exchange_Rate__c = getExchangeRate(bankId);
            List<SObject> recordsToInsert = new List<SObject>{ spoa };
            recordsToInsert = DBOpsUtils.s2p3Insert(recordsToInsert);

            Sales_POA_Lines__c spoaLine = new Sales_POA_Lines__c();
            spoaLine.Unit_Price__c = unitPrice;
            spoaLine.Quantity__c = 1;
            spoaLine.Sub_Ledger__c = bank.Sub_Ledger__c;
            spoaLine.Tax_Group__c = bank.Tax_Group_for_Payment_on_Account__c;
            spoaLine.Net_Amount__c = unitPrice;
            spoaLine.Gross_Amount__c = unitPrice;
            spoaLine.Sales_POA__c = recordsToInsert[0].Id;
            List<SObject> recordsToInsertline = new List<SObject>{ spoaLine };
            recordsToInsertline = DBOpsUtils.s2p3Insert(recordsToInsertline);
            handlePostOnSPOARecord(recordsToInsert[0].Id);
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }

    }

    public static double getExchangeRate(String bankRecordId) {
        List<Bank__c> bankRecord = [SELECT Id, Currency__c FROM Bank__c WHERE Id = :bankRecordId WITH SECURITY_ENFORCED];
        if (bankRecord.isEmpty()) {
            return null;
        }
        Date todayDate = Date.today();
        List<Currency_Exchange_Rate__c> exchangeRateList = [SELECT Id, Exchange_Rate__c FROM Currency_Exchange_Rate__c WHERE Purpose__c = 'Transactional' AND To_Currency__c = :bankRecord[0].Currency__c AND From_Date__c <=:todayDate WITH SECURITY_ENFORCED ORDER BY From_Date__c DESC LIMIT 1];
        if (exchangeRateList.isEmpty() || exchangeRateList[0].Exchange_Rate__c == null) {
            return null;
        }
        return exchangeRateList[0].Exchange_Rate__c;
    }

    @AuraEnabled
    public static void createBRFXGainLoss(string bankId, String reference, String selectedDate, Decimal unitPrice){
        try {
            List<Bank__c> bankRecord = [SELECT Id, Currency__c, Account__c, Subledger_for_FX_Gain_Loss__c, Tax_Group_for_FX_Gain_Loss__c FROM Bank__c WHERE Id = :bankId WITH SECURITY_ENFORCED];
            Bank_Receipt_Header__c  brHeader = new Bank_Receipt_Header__c ();
            brHeader.To_Account__c = bankRecord[0].Account__c;
            brHeader.Invoice_Date__c = Date.valueof(selectedDate);
            brHeader.Customer_Reference__c = (reference != null && reference.length() > 25) ? reference.substring(0, 25) : reference;
            brHeader.Transaction_Currency__c = bankRecord[0].Currency__c;
            brHeader.Transaction_Currency_Exchange_Rate__c = getExchangeRate(bankId);
            brHeader.Bank_Account__c = bankId;
            brHeader.Company__c = UtilsController.getCompanyInformation().Id;
            List<SObject> recordsToInsert = new List<SObject>{ brHeader };
            recordsToInsert = DBOpsUtils.s2p3Insert(recordsToInsert);

            Bank_Receipt_Transaction__c  brTransaction = new Bank_Receipt_Transaction__c();
            brTransaction.Quantity__c = 1;
            brTransaction.Unit_Price__c = unitPrice;
            brTransaction.Sub_Ledger__c = bankRecord[0].Subledger_for_FX_Gain_Loss__c;
            brTransaction.Tax_Group__c = bankRecord[0].Tax_Group_for_FX_Gain_Loss__c;
            brTransaction.Net_Amount__c = unitPrice;
            brTransaction.Gross_Amount__c = unitPrice;
            brTransaction.Bank_Receipt_Header__c = recordsToInsert[0].Id;
            List<SObject> recordsToInsertline = new List<SObject>{ brTransaction };
            recordsToInsertline = DBOpsUtils.s2p3Insert(recordsToInsertline);

            CreateBankReceiptController.handlePostOnBankRecord(recordsToInsert[0].Id);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public static void handlePostOnSPOARecord(String spoaRecordId) {
        List<TransactionPostingService.RequestParams> paramList = new List<TransactionPostingService.RequestParams>();
        TransactionPostingService.RequestParams req = new TransactionPostingService.RequestParams();

        String namespace = UtilsController.getNameSpace();

        req.recordIdSingle = spoaRecordId;
        req.masterObjectName = 'Sales_POA__c';
        req.detailObjectName = 'Sales_POA_Lines__c';
        req.fieldSetNameHeader = namespace + 'Ledger_Entry_Postings';
        req.fieldSetNameLines = namespace + 'Ledger_Entry_Lines';
        req.transUID = 'SA';
        paramList.add(req);
        TransactionPostingService.postSalesInvoice(paramList);
	}

}
