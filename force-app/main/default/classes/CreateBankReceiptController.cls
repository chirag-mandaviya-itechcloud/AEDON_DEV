public class CreateBankReceiptController {
	@AuraEnabled
	public static List<Bank_Receipt_Header__c> fetchExistingReceipts(Id bankRecordId){
		List<Bank_Receipt_Header__c> bankReceipts = new List<Bank_Receipt_Header__c>();
		String qryBuild = ' SELECT Id, Name, Invoice_Date__c, Customer_Reference__c, Currency__r.Name, Gross_Amount__c, Posting_Status__c FROM Bank_Receipt_Header__c WHERE Bank_Account__c = :bankRecordId WITH SECURITY_ENFORCED';
		bankReceipts = Database.query(qryBuild);
		return bankReceipts;
	}

	@AuraEnabled
	public static List<sObject> saveReceiptHeaderDetails(String accountId, Date invoiceDate, String customerReference, String currencyId, Decimal exchangeRate, String bankRecordId){
		try {
			Bank_Receipt_Header__c bankReceipt = new Bank_Receipt_Header__c();
			bankReceipt.To_Account__c = accountId;
			bankReceipt.Invoice_Date__c = invoiceDate;
			bankReceipt.Customer_Reference__c = customerReference;
			bankReceipt.Transaction_Currency__c = currencyId;
			bankReceipt.Transaction_Currency_Exchange_Rate__c = exchangeRate;
			bankReceipt.Bank_Account__c = bankRecordId;
			bankReceipt.Company__c = UtilsController.getCompanyInformation().Id;
			List<sObject> resultList = DBOpsUtils.s2p3Insert(new List<sObject>{ bankReceipt });
			return resultList;

		} catch (Exception e) {
			system.debug('ex=>'+e.getStackTraceString());
            throw new AuraHandledException(e.getMessage());
		}
	}

    @AuraEnabled
    public static void handlePostOnBankRecord(String bankReceiptHeaderId) {
        List<TransactionPostingService.RequestParams> paramList = new List<TransactionPostingService.RequestParams>();
        TransactionPostingService.RequestParams req = new TransactionPostingService.RequestParams();

		List<Bank_Receipt_Transaction__c> bankReceiptTransactions = [SELECT Id FROM Bank_Receipt_Transaction__c WHERE Bank_Receipt_Header__c = :bankReceiptHeaderId WITH SECURITY_ENFORCED];

		if(bankReceiptTransactions.isEmpty()) {
			throw new AuraHandledException('Please Add Line Items before Posting the Bank Receipt.');
		}
        
        String namespace = UtilsController.getNameSpace();

        //req.recordIds = new List<Id>{bankReceiptHeaderId};
        req.recordIdSingle = bankReceiptHeaderId;
        req.masterObjectName = 'Bank_Receipt_Header__c';
        req.detailObjectName = 'Bank_Receipt_Transaction__c';
        req.fieldSetNameHeader = namespace + 'Ledger_Entry_Postings';
        req.fieldSetNameLines = namespace + 'Ledger_Entry_Lines';
        req.transUID = 'BR';
        paramList.add(req);
        TransactionPostingService.postSalesInvoice(paramList);
	}
}