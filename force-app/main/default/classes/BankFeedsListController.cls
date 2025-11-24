public class BankFeedsListController {

    @AuraEnabled
    public static void saveBankFeed(Date DateSet, String Inotes, String Description, String Refrence, Decimal Receipt, Decimal Payment, String recordId) {
        try{
            Bank_Feed__c bf = new Bank_Feed__c();
            bf.Date__C = DateSet;
            bf.Internal_Notes__c = Inotes;
            bf.Description__c = Description;
            bf.Reference__c = Refrence;
            bf.Receipt__c = Receipt;
            bf.Payment__c = Payment;
            bf.Bank__c = recordId;
            insert bf;
        } catch (Exception ex){
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Bank_Feed__c> getBankFeedList(Id recordId) {
        Date pastFiveDate = Date.today().AddDays(-5);
        Date todayDate = Date.today();
        List<Bank_Feed__c> bankFeed = new List<Bank_Feed__c>();
        String qryBuild = 'SELECT Id, Name, Date__c, Reference__c, Description__c, Receipt__c, Payment__c, Source__c, Status__c, Internal_Notes__c FROM Bank_Feed__c WHERE Bank__c = :recordId';
        qryBuild += ' AND Date__c >=:pastFiveDate AND Date__c <=:todayDate LIMIT 2000';
        bankFeed = Database.query(qryBuild);
        return bankFeed;
    }

    @AuraEnabled(cacheable=true)
    public static List<Bank_Feed__c> getFilterData(Id recordId, String selectView, Date fromDate, Date toDate, String filReference, String filDescription, String Amount, String filINotes) {
        List<Bank_Feed__c> bankFeed = new List<Bank_Feed__c>();
        String qryBuild = 'SELECT Id, Name, Date__c, Reference__c, Description__c, Receipt__c, Payment__c, Source__c, Status__c, Internal_Notes__c FROM Bank_Feed__c WHERE Bank__c = :recordId';
        if(String.isNotBlank(selectView) && selectView != 'All') {
            qryBuild += ' AND Status__c=:selectView' ;
        } if (fromDate != null) {
            fromDate = (Date)fromDate;
            qryBuild += ' AND Date__c >=:fromDate ';
        } if (toDate != null) {
            toDate = (Date)toDate;
            qryBuild += ' AND Date__c <=:toDate ';
        } if (String.isNotBlank(filReference)) {
            qryBuild += ' AND Reference__c Like' + '\'%' +filReference + '%\''  ;
        } if(String.isNotBlank(filDescription)) {
            qryBuild += ' AND Description__c Like' + '\'%' +filDescription + '%\'';
        } if (String.isNotBlank(Amount)) {

            Amount = Amount.trim();
            String operator = '';
            Decimal amountValue;

            if (Amount.startsWith('<') || Amount.startsWith('>') || Amount.startsWith('=')) {
                operator = Amount.substring(0, 1);
                amountValue = Decimal.valueOf(Amount.substring(1));
            } else {
                operator = '=';
                amountValue = Decimal.valueOf(Amount);
            }
            qryBuild += ' AND (s2p3__Receipt__c ' + operator + ' :amountValue OR s2p3__Payment__c ' + operator + ' :amountValue)';
        } if(String.isNotBlank(filINotes)) {
            qryBuild += ' AND Internal_Notes__c Like' + '\'%' + filINotes +'%\'';
        }
        qryBuild += ' LIMIT 2000';
        System.debug('qryBuild=>'+qryBuild);
        bankFeed = Database.query(qryBuild);
        return bankFeed;
    }
}