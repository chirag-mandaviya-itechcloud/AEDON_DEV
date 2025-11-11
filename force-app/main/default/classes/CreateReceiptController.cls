public class CreateReceiptController {
	@AuraEnabled
	public static List<Bank_Receipt_Header__c> fetchExistingReceipts(Id bankRecordId){	
		List<Bank_Receipt_Header__c> bankReceipts = new List<Bank_Receipt_Header__c>();
		String qryBuild = ' SELECT Id, Name, s2p3__Invoice_Date__c, s2p3__Customer_Reference__c, s2p3__Currency__c, s2p3__Gross_Amount__c FROM s2p3__Bank_Receipt_Header__c WHERE s2p3__Bank_Account__c = :bankRecordId';		
		bankReceipts = Database.query(qryBuild);
		return bankReceipts;
	}	
}