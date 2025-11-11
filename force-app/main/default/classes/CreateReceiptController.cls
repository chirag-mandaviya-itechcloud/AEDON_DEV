public class CreateReceiptController {
	@AuraEnabled
	public static List<Bank_Receipt_Header__c> fetchExistingReceipts(Id bankRecordId){
		List<Bank_Receipt_Header__c> bankReceipts = new List<Bank_Receipt_Header__c>();
		String qryBuild = ' SELECT Id, Name, Invoice_Date__c, Customer_Reference__c, Currency__r.Name, Gross_Amount__c FROM Bank_Receipt_Header__c WHERE Bank_Account__c = :bankRecordId WITH SECURITY_ENFORCED';
		bankReceipts = Database.query(qryBuild);
		return bankReceipts;
	}

	@AuraEnabled
	public static void saveReceiptHeaderDetails(String accountId, Date invoiceDate, String customerReference, String currencyId, Decimal exchangeRate, String bankRecordId){
		try {
			Bank_Receipt_Header__c bankReceipt = new Bank_Receipt_Header__c();
			bankReceipt.To_Account__c = accountId;
			bankReceipt.Invoice_Date__c = invoiceDate;
			bankReceipt.Customer_Reference__c = customerReference;
			bankReceipt.Currency__c = currencyId;
			bankReceipt.Currency_Exchange_Rate__c = exchangeRate;
			bankReceipt.Bank_Account__c = bankRecordId;
			bankReceipt.Company__c = UtilsController.getCompanyInformation().Id;
			List<sObject> resultList = DBOpsUtils.s2p3Insert(new List<sObject>{ bankReceipt });

		} catch (Exception e) {
			system.debug('ex=>'+e.getStackTraceString());
            throw new AuraHandledException(e.getMessage());
		}
	}
}
