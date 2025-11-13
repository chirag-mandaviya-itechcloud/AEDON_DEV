public class CalculateBankStatementBalanceBatch implements Database.Batchable<SObject>,Database.Stateful {

	public Id bankId;
	public Decimal totalReceipts = 0;
    public Decimal totalPayments = 0;

	public CalculateBankStatementBalanceBatch(Id bankId) {
		this.bankId = bankId;
	}

	public Database.QueryLocator start(Database.BatchableContext BC) {
		String query = 'SELECT Id, Bank__c, Receipt__c, Payment__c FROM Bank_Feed__c WHERE Bank__c = :bankId';
		return Database.getQueryLocator(query);
	}

	public void execute(Database.BatchableContext BC, List<Bank_Feed__c> scope) {
		for (Bank_Feed__c record : scope) {
            this.totalReceipts += (record.Receipt__c != null ? record.Receipt__c : 0);
            this.totalPayments += (record.Payment__c != null ? record.Payment__c : 0);
        }
	}

	public void finish(Database.BatchableContext BC) {
		Decimal finalBalance = this.totalReceipts - this.totalPayments;

        Bank__c bankObj = new Bank__c(
            Id = bankId,
            Statement_Balance__c = finalBalance
        );
        update bankObj;
	}
}
