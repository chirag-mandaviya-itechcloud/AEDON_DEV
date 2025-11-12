public without sharing class GridTableDynamicController {
    
    //Connecting field - that connects parent & child (Lookup FielApiName)
    public static String foreginKey = '';
    public static String foreginKeyByUser = '';
    
    /**
* @description getObjectRecordData - To Query all the records with specified fields inside the fieldSet
* @author Anand Dasani
* @param  objectAPIName       Child Object's Name
* @param  fieldSetName        Child Object's Feilds to consider in the table
* @param  parentRecordId      Parent Object's Record Id on (extracted from the record page)
* @param  parentObjectApiName Child Object's Name
* @return                     return Querying all the records with specified fields inside the fieldSet
*/
    
 /*   @AuraEnabled 
    public static Map<String, String> getAnalysisLabels() {
        Map<String, String> analysisLabels = new Map<String, String>();
        
        String userId;
        if(!Test.isRunningTest()) {
            userId = String.valueOf(UserInfo.getUserId()); 
        } else {
            User u = [SELECT Id,Name,Email FROM User WHERE Email='testuser@gmail.com' WITH SECURITY_ENFORCED LIMIT 1];
            userId = u.Id;
        }
        
        List<User_Company__c> lstUserCompany = [SELECT Id, Name, User__c, User__r.Name, Current_Logged_In_Company__c,s2p3__Current_Logged_In_Company__r.s2p3__VAT_Registration_Number__c, Current_Logged_In_Company__r.Name FROM User_Company__c WHERE User__c=:userId WITH SECURITY_ENFORCED LIMIT 1];
        String companyID = lstUserCompany[0].Current_Logged_In_Company__c;
        
        // Single SOQL query to fetch the records
        List<Analysis_Code_Config__c> configs = [
            SELECT Analysis_Code_API__c, Analysis_Code_Label__c
            FROM Analysis_Code_Config__c WHERE Company__c =: companyID
        ];
        
        // Process records to populate the map
        for (Analysis_Code_Config__c config : configs) {
            analysisLabels.put(config.Analysis_Code_API__c, config.Analysis_Code_Label__c);
        }
        
        return analysisLabels;
    } */
    @AuraEnabled
    public static List<SObject> getObjectRecordData(String objectAPIName, String fieldSetName, String parentRecordId, String parentObjectApiName, String parentChildRelationApiName, String sortingFields, String sortingOrder) {
        System.debug('\n<<<<<< getObjectRecordData >>>>>>>');
        System.debug('sortingFeilds: ' + sortingFields);
        System.debug('sortingOrder: ' + sortingOrder);
        
        //--------------- Security Check Starts ---------------
        objectAPIName = String.isNotBlank(objectAPIName) ? String.escapeSingleQuotes(objectAPIName) : objectAPIName;
        fieldSetName = String.isNotBlank(fieldSetName) ? String.escapeSingleQuotes(fieldSetName) : fieldSetName;
        parentRecordId = String.isNotBlank(parentRecordId) ? String.escapeSingleQuotes(parentRecordId) : parentRecordId;
        parentObjectApiName = String.isNotBlank(parentObjectApiName) ? String.escapeSingleQuotes(parentObjectApiName) : parentObjectApiName;
        sortingFields = String.isNotBlank(sortingFields) ? String.escapeSingleQuotes(sortingFields).normalizeSpace().removeEnd(',') : 'CreatedDate';
        sortingOrder = String.isNotBlank(sortingOrder) ? String.escapeSingleQuotes(sortingOrder) : '';
        
        if(String.isNotBlank(parentChildRelationApiName)) {
            parentChildRelationApiName = String.escapeSingleQuotes(parentChildRelationApiName);
            foreginKeyByUser = parentChildRelationApiName;
            System.debug('objectAPIName: ' + objectAPIName);
            System.debug('foreginKeyByUser: ' + foreginKeyByUser);
            validateUserGivenForegienKey(objectAPIName, foreginKeyByUser);
        }
        
        //ObjectApiName Check
        Boolean isValidSObjectType = Schema.getGlobalDescribe().containsKey(objectApiName);
        if(!isValidSObjectType)
            throw new AuraHandledException('Invalid input of ObjectApiName: ' + objectApiName);
        
        //FieldSet Name Check
        Boolean isValidFieldSet = Schema.getGlobalDescribe().get(objectApiName).getDescribe().fieldsets.getMap().containsKey(fieldSetName);
        if(!isValidFieldSet)
            throw new AuraHandledException('Invalid input of FieldSet: ' + fieldSetName);
        
        //Accessibility Check
        Boolean isObjectAccessible = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isAccessible();
        if(!isObjectAccessible)
            throw new AuraHandledException(objectApiName + ' is not accessible');
        
        //Query Check
        Boolean isObjectQueryable = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isQueryable();
        if(!isObjectQueryable)
            throw new AuraHandledException('Can\'t Query Object: ' + objectApiName);
        
        //Check the Sorting Fields present or not in the object
        Map<String,Schema.SObjectField> fieldsMapOfObject = Schema.getGlobalDescribe().get(objectApiName).getDescribe().fields.getMap();
        List<String> fieldsToCheck = sortingFields.split(',');
        for(String fieldName : fieldsToCheck){
            if(!fieldsMapOfObject.containsKey(fieldName.trim())){
                throw new AuraHandledException('Sorting field: "' + fieldName + '" not present in ' + objectApiName);
            }
        }
        
        //--------------- Security Check Ends ---------------
        
        //get all fields inside the field set
        List<fieldSetDetails> fieldDetailsList = fetchFields(objectAPIName, fieldSetName, parentRecordId, parentObjectApiName);
        List<SObject> queryResults = new List<sObject>();
        List<String> fieldsToQuery = new List<String>();
        
        try {
            for (fieldSetDetails fd : fieldDetailsList) {
                fieldsToQuery.add(fd.fieldName);
            }
            
            //Check if foreginKey found by system matches foreginKeyByUser (If given by user)
            if(String.isNotBlank(foreginKeyByUser) || foreginKeyByUser != ''){
                if(foreginKeyByUser.equalsIgnoreCase(foreginKey)){
                    System.debug('%%%System Found Correct Foregin Key: ' + foreginKey);
                } else {
                    System.debug('###System Unable to find Foregin Key while processing fieldSet, assigning user given foreign key');
                    foreginKey = foreginKeyByUser;
                }
            }
            System.debug('foreginKey: ' + foreginKey);
            
            //create dynamic query based on fields from field set
            String whereCluase = '';
            String orderByClause = 'ORDER BY ' + sortingFields + ' ' + sortingOrder;
            if(foreginKey != null && foreginKey != '')
                whereCluase = ' WHERE ' +foreginKey+ ' = :parentRecordId  ';
            else {
                System.debug('Finding Foregin Key Explicitly....');
                //Field Set was not containing connecting field - so finding explicitly from all the fields in the object
                foreginKey = findForeignKey(objectAPIName, parentObjectApiName);
                System.debug('Foregin Key after performing search ::: ' + foreginKey);
                
                if(foreginKey != null && foreginKey != '')
                    whereCluase = ' WHERE ' +foreginKey+ ' = :parentRecordId  ';
                else
                    whereCluase = '  ';
            }
            
            String query = 'SELECT ';
            query += String.join( fieldsToQuery, ', ' );
            query = query.removeEnd(', ') + ' FROM ' + objectAPIName + whereCluase + orderByClause;
            System.debug('Query Formed is ::: ' + query);
            
            // Execute the query
            queryResults = Database.query(String.escapeSingleQuotes(query));
            System.debug('Query Results is ::: ' + queryResults);
        } catch(Exception e) {
            System.debug(e.getMessage());
            queryResults = new List<sObject>();
            throw new AuraHandledException('No record found, Reason: ' + e.getMessage());
        }
        return queryResults;
    }
    
    /**
* @description fetchFields - To prepare list of fields to be included in the table (which is extracted from the fieldSet) & excluding misc fields which are out of scope for this component.
* @author Anand Dasani
* @param  objectApiName       Child Object's Name
* @param  fieldSetName        Child Object's Feilds to consider in the table
* @param  parentRecordId      Parent Object's Record Id on (extracted from the record page)
* @param  parentObjectApiName Child Object's Name
* @return                     return list of fields
*/
    @AuraEnabled
    public static List<fieldSetDetails> fetchFields(String objectApiName, String fieldSetName, String parentRecordId, String parentObjectApiName) {
        System.debug('\n<<<<<< fetchFields >>>>>>>');
        System.debug('parentObjectApiName :: ' + parentObjectApiName);
        System.debug('parentRecordId :: ' + parentRecordId);
        String parentObjectApiNameTemp = parentObjectApiName;
        String pReferenceObj = '';
        Boolean foundInAccessibleField = false;
        
     //   String namespacePrefix = SvcUtils.getrelevantNameSpace1();
        
        //--------------- Security Check Starts ---------------
        
        objectAPIName = String.isNotBlank(objectAPIName) ? String.escapeSingleQuotes(objectAPIName) : objectAPIName;
        fieldSetName = String.isNotBlank(fieldSetName) ? String.escapeSingleQuotes(fieldSetName) : fieldSetName;
        parentRecordId = String.isNotBlank(parentRecordId) ? String.escapeSingleQuotes(parentRecordId) : parentRecordId;
        parentObjectApiName = String.isNotBlank(parentObjectApiName) ? String.escapeSingleQuotes(parentObjectApiName) : parentObjectApiName;
        
        //ObjectApiName Check
        Boolean isValidSObjectType = Schema.getGlobalDescribe().containsKey(objectApiName);
        if(!isValidSObjectType)
            throw new AuraHandledException('Invalid input of ObjectApiName: ' + objectApiName);
        
        //FieldSet Name Check
        Boolean isValidFieldSet = Schema.getGlobalDescribe().get(objectApiName).getDescribe().fieldsets.getMap().containsKey(fieldSetName);
        if(!isValidFieldSet)
            throw new AuraHandledException('Invalid input of FieldSet: ' + fieldSetName);
        
        //Accessibility Check
        Boolean isObjectAccessible = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isAccessible();
        if(!isObjectAccessible)
            throw new AuraHandledException(objectApiName + ' is not accessible');
        
        //--------------- Security Check Ends ---------------
        
        List<fieldSetDetails> fieldDetailsList = new List<fieldSetDetails>(); //pass this to the lwc - js
        List<Schema.FieldSetMember> fieldSetList = new List<Schema.FieldSetMember>();
        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
        if (objectType != null) {
            Boolean isEditable = false;
            Schema.FieldSet fieldSet = objectType.getDescribe().fieldSets.getMap().get(fieldSetName);
            fieldSetList = fieldSet.getFields();
            
            for (Schema.FieldSetMember field : fieldSetList) {
                //revert back the objectType back to the original after altering down for particular field
                objectType = Schema.getGlobalDescribe().get(objectApiName);
                
                //Check if this field is editable, creatable, sortable
                System.debug('\n\nWorking on ::: ' + field.getFieldPath());
                System.debug('field.getSObjectField() ::: ' + field.getSObjectField());
                System.debug('field.getLabel() ::: ' + field.getLabel());
                System.debug('field.getRequired() ::: ' + field.getRequired());

                String mField = field.getFieldPath();
                String columnLabel = field.getLabel();
                
                //If Parent Field comes like Account.Name on fieldset
                if(mField.containsIgnoreCase('__r.') || mField.containsIgnoreCase('.')){
                    System.debug('@@@Misc Handling: ' + mField);
                    List<String> mFieldSplit = String.valueOf(mField).split('\\.');
                    System.debug('mFieldSplit : ' + mFieldSplit);
                    
                    if(mField.containsIgnoreCase('__r.'))
                        pReferenceObj = mFieldSplit[0].replace('__r', '__c');
                    else
                        pReferenceObj = mFieldSplit[0].replace('.', '');
                    
                    //String pReferenceField = mFieldSplit[1]; // - custom way
                    String pReferenceField = String.valueOf(field.getSObjectField()); // - standard way
                    System.debug('parentReference:: ' + pReferenceObj);
                    System.debug('parentReferenceField:: ' + pReferenceField);
                    
                    objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    mField = pReferenceField;
                    
                    //CASE-1: In case of standart object occurence it will lead to catch block so just remove __c from it
                    if(objectType == null){
                        System.debug('removing __c from as ' + pReferenceObj + ' is standard object');
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.removeEndIgnoreCase('__c').trim());
                    }
                    System.debug('Object Type Set to ' + pReferenceObj + ' in ' + objectType + ' & mField = ' + mField);
                    
                    //CASE-2: In case of Owner, LastModifiedBy, CreatedBy etc.. object will be User not owner itself
                    if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Owner') || pReferenceObj.containsIgnoreCase('CreatedBy') || pReferenceObj.containsIgnoreCase('LastModifiedBy') ){
                            System.debug('Changing pReferenceObj from owner to user...');
                            pReferenceObj = 'User';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    }
                    System.debug('Object Type Set to ' + pReferenceObj + ' in ' + objectType + ' & mField = ' + mField);
                    
                    if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Product__c')){
                            System.debug('Changing pReferenceObj from s2p3__Product__c to Product2...');
                            pReferenceObj = 'Product2';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    }
                    System.debug('Object Type Set to ' + pReferenceObj + ' in ' + objectType + ' & mField = ' + mField);
                    
                 /*   if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Nominal_Code')){
                            pReferenceObj = namespacePrefix+'Chart_Of_Accounts__c';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    }
                    if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Sale_VAT__c') || pReferenceObj.containsIgnoreCase('Purchase_VAT__c')){
                            pReferenceObj = namespacePrefix+'VAT__c';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    }
                    if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Analysis1')){
                            pReferenceObj = namespacePrefix+'Analysis_1__c';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    }
                    if(objectType == null){
                        if(pReferenceObj.containsIgnoreCase('Analysis2')){
                            pReferenceObj = namespacePrefix+'Analysis_2__c';
                        }
                        objectType = Schema.getGlobalDescribe().get(pReferenceObj.trim());
                    } */
                    System.debug('Object Type Set to ' + pReferenceObj + ' in ' + objectType + ' & mField = ' + mField);
                    
                    //CASE-3: SKIP
                    if(objectType == null){
                        System.debug('<<<<<<Skipping : ' + mField + '>>>>>>');
                        continue; //skip this field then...
                    }
                }
                
                try {
                    System.debug('Trying to get DFR for : ' + mField + ' from : ' + pReferenceObj);
                    Schema.DescribeFieldResult dfr = objectType.getDescribe().fields.getMap().get(mField).getDescribe();
                    String fieldTypeSFFormattedSF = getLightningDatatypeEquivalent(String.valueOf(field.getType()), dfr);
                    
                    //If this field is not accessible then stop here itself
                    if(!dfr.isAccessible()){
                        System.debug('This Field is not accessible: ' + field.getLabel());
                        foundInAccessibleField = true;
                        throw new AuraHandledException(field.getLabel() + ' is not accessible, please remove it from fieldSet');
                    }
                    
                    //Just Debug of Refrence options
                    if(fieldTypeSFFormattedSF == 'lookup'){
                        System.debug('\n<<<<<< LOOKUP >>>>>>>');
                        System.debug('dfr.getReferenceTargetField():: ' + dfr.getReferenceTargetField());
                        System.debug('dfr.getReferenceTo():: ' + dfr.getReferenceTo());
                        System.debug('dfr.getRelationshipName():: ' + dfr.getRelationshipName());
                        System.debug('dfr.getFilteredLookupInfo():: ' + dfr.getFilteredLookupInfo());
                        System.debug('dfr.getRelationshipOrder():: ' + dfr.getRelationshipOrder());
                        
                        String relationshipName = dfr.getRelationshipName();
                        String relationshipNameTemp = relationshipName.replace('__r', '');
                        System.debug('relationshipNameTemp:: ' + relationshipNameTemp);
                        
                        if(parentObjectApiName.contains('__c'))
                            parentObjectApiNameTemp = parentObjectApiName.replace('__c', '');
                        System.debug('parentObjectApiNameTemp:: ' + parentObjectApiNameTemp);
                        
                        //check if this relationship name is same as parent object of this child object
                        if(parentObjectApiNameTemp.equalsIgnoreCase(relationshipNameTemp)){
                            foreginKey = field.getFieldPath();
                            System.debug('Found Key Field (Of Connection): ' + foreginKey);
                            
                            if(foreginKey.contains('.')){
                                System.debug('!!!!!This foregin is a false assumption.. reseting foregin key!!!!');
                                foreginKey = null;
                            }
                        }
                        
                        System.debug('<<<<<< LOOKUP >>>>>>>');
                    }
                    
                    if(String.valueOf(field.getFieldPath()).contains('.')){
                        //TODO: Skipping Parent Fields (Account.Name) for now
                        isEditable = false;
                        System.debug('@@@Skipping ' + field.getFieldPath() + ' isEditable :: ' + isEditable);
                    } else if (dfr.getReferenceTo().size() > 0 && !dfr.isCustom()) {
                        //Skip Default Lookup like OwnerId, CreatedBy, etc.
                        isEditable = false;
                        System.debug('@@@Skipping ' + field.getFieldPath() + ' isEditable :: ' + isEditable);
                    } else if (fieldTypeSFFormattedSF.equalsIgnoreCase('dependentPicklist') || fieldTypeSFFormattedSF == 'dependentPicklist') {
                        //Skip Default Dependent Picklist
                        isEditable = false;
                        System.debug('@@@Skipping Dependent Picklist' + field.getFieldPath() + ' isEditable :: ' + isEditable);
                    } else if (fieldTypeSFFormattedSF.equalsIgnoreCase('address') || fieldTypeSFFormattedSF == 'address') {
                        //TODO: Skip Address Fields - Right Now it's working
                        //isEditable = false;
                        System.debug('@@@Address Field' + field.getFieldPath() + ' isEditable :: ' + isEditable);
                    } else {
                        isEditable = dfr.isUpdateable();
                        System.debug(field.getFieldPath() + ' isEditable :: ' + isEditable);
                    }
                    
                    fieldSetDetails fd = new fieldSetDetails(
                        field.getLabel(),
                        field.getFieldPath(),
                        fieldTypeSFFormattedSF,
                        isEditable,
                        field.getRequired(),
                        dfr.getReferenceTo().size() > 0 ? String.valueof(dfr.getReferenceTo()[0]) : 'null');
                    
                    fieldDetailsList.add(fd);
                    
                } catch (Exception e) {
                    System.debug(e.getMessage());
                    if(foundInAccessibleField){
                        foundInAccessibleField = false;
                        throw new AuraHandledException(field.getLabel() + ' is not accessible, please remove it from fieldSet');
                    }
                }
            }
        }
        System.debug('@@@fieldDetailsList ::: ' + fieldDetailsList);
        return fieldDetailsList;
    }
    
    /**
* @description findForeignKey - To fetch all the fields of child object and searching for the connecting field's FieldApiName which connected the Parent & Child object (via lookup)
* @author Author Name
* @param  objectAPIName       objectAPIName - Child Object's Name
* @param  parentObjectApiName parentObjectApiName - Parent Object's Name
* @return                     return fieldApiName - if found any otherwise null
*/
    @AuraEnabled
    public static String findForeignKey(String objectAPIName, String parentObjectApiName){
        Map<String, Schema.SObjectField> fields = Schema.getGlobalDescribe().get(objectAPIName).getDescribe().fields.getMap();
        String parentObjectApiNameTemp = parentObjectApiName;
        
        //--------------- Security Check Starts ---------------
        
        objectAPIName = String.isNotBlank(objectAPIName) ? String.escapeSingleQuotes(objectAPIName) : objectAPIName;
        parentObjectApiName = String.isNotBlank(parentObjectApiName) ? String.escapeSingleQuotes(parentObjectApiName) : parentObjectApiName;
        
        //ObjectApiName Check
        Boolean isValidSObjectType = Schema.getGlobalDescribe().containsKey(objectApiName);
        if(!isValidSObjectType)
            throw new AuraHandledException('Invalid input of ObjectApiName: ' + objectApiName);
        
        //Accessibility Check
        Boolean isObjectAccessible = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isAccessible();
        if(!isObjectAccessible)
            throw new AuraHandledException(objectApiName + ' is not accessible');
        
        
        //--------------- Security Check Ends ---------------
        
        //No Need to find foreginKey if user has already provided it from the layout page (Input)
        if(foreginKey != '' || String.isNotBlank(foreginKey)) {
            System.debug('@@findForeignKey > Foregin Key Already Provided: ' + foreginKey);
            return foreginKey;
        }
        
        for(Schema.SObjectField fieldRef : fields.values()) {
            Schema.DescribeFieldResult dfr = fieldRef.getDescribe();
            
            String fieldTypeSFFormattedSF = getLightningDatatypeEquivalent(String.valueOf(dfr.getType()), dfr);
            
            if(fieldTypeSFFormattedSF == 'lookup'){
                String relationshipName = dfr.getRelationshipName();
                String relationshipNameTemp = relationshipName.replace('__r', '');
                System.debug('relationshipNameTemp:: ' + relationshipNameTemp);
                
                if(parentObjectApiName.contains('__c'))
                    parentObjectApiNameTemp = parentObjectApiName.replace('__c', '');
                System.debug('parentObjectApiNameTemp:: ' + parentObjectApiNameTemp);
                
                //check if this relationship name is same as parent object of this child object
                if(parentObjectApiNameTemp.equalsIgnoreCase(relationshipNameTemp)){
                    foreginKey = dfr.getName();
                    System.debug('Found Key Field (Of Connection): ' + foreginKey);
                    return dfr.getName();
                }
            }
        }
        
        return null; //When no foregin key is found
    }
    
    /**
* @description updateRecord - To update sObject (Generic) Record of any type
* @author Anand Dasani
* @param  data          List to update with updated fields (by user)
* @param  objectApiName Name of Object to update
* @return               return Success messaage if the update was successful otherwise failure message
*/
   @AuraEnabled(cacheable=true)
    public static Decimal getVATRecords(String recordID) {
        recordID = String.isNotBlank(recordID) ? String.escapeSingleQuotes(recordID) : recordID;
        //return [SELECT Id, Name FROM s2p3__Tax_Group__c WHERE Id =: recordID];
        AggregateResult[] results = [SELECT SUM(Tax_Rate__c) totalRate FROM s2p3__Associated_Tax__c WHERE s2p3__Tax_Group__c = :recordID];
        
        return (results.isEmpty() || results[0].get('totalRate') == null) ? 0 : (Decimal) results[0].get('totalRate');
        
    } 
    @AuraEnabled
    public static List<s2p3__Associated_Tax__c> getTaxCodes(String taxID) {
        
        return [SELECT Id,Name,s2p3__Tax_Rate__c,s2p3__Tax_Name__c from s2p3__Associated_Tax__c where s2p3__Tax_Group__c =:taxID];
    } 
    
    @AuraEnabled
    public static String updateRecord(List<object> data, String objectApiName){
        
        System.debug('@@@updateRecord: Updating Record of ->' + objectApiName);
        System.debug('@@@updateRecord: Receved this list ->' + data);
        
        //--------------- Security Check Starts ---------------
        
        objectAPIName = String.isNotBlank(objectAPIName) ? String.escapeSingleQuotes(objectAPIName) : objectAPIName;
        
        String companyID = '';
            List<User> usersList = [SELECT ID, Name, Current_Logged_In_Company__c FROM User WHERE Id = :UserInfo.getUserId() WITH SECURITY_ENFORCED];
            if(usersList.size() > 0){
                if(usersList[0].Current_Logged_In_Company__c != null){
                    Company__c companyObj = [Select Id, Name from Company__c where Id =: usersList[0].Current_Logged_In_Company__c WITH SECURITY_ENFORCED];
                    companyID = companyObj.Id;
                }
            }
        
        //ObjectApiName Check
        Boolean isValidSObjectType = Schema.getGlobalDescribe().containsKey(objectApiName);
        if(!isValidSObjectType)
            throw new AuraHandledException('Invalid input of ObjectApiName: ' + objectApiName);
        
        //Accessibility Check
        Boolean isObjectAccessible = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isAccessible();
        if(!isObjectAccessible)
            throw new AuraHandledException(objectApiName + ' is not accessible');
        
        //Update Check
        Boolean isObjectUpdateable = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isUpdateable();
        if(!isObjectUpdateable)
            throw new AuraHandledException(objectApiName + ' is not updateable');
        
        //Create Check
        Boolean isObjectCreatable = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isCreateable();
        if(!isObjectCreatable)
            throw new AuraHandledException(objectApiName + ' is not createable');
        
        //--------------- Security Check Ends ---------------
        
        if(data == null || data.size() == 0)
            throw new AuraHandledException('None of the row has been changed or added');
        
        //Map to store converted data of List<object> data -> Map
        Map<String, Object> resultMap = new Map<String, Object>();
        
        //List of sObject to update
        List<SObject> recordsToUpdate = new List<SObject>();
        
        //get the object describe
        Schema.SObjectType oSObjectType = Schema.getGlobalDescribe().get(objectApiName);
        
        for(Object dataObj : data){
            System.debug('<<< Object >>>');
            
            //Create the instance of the object
            SObject newSObj = oSObjectType.newSObject();
            Map<Object,Object> record = (Map<Object, Object>) dataObj;
            
            for(Object recMapKey : record.keySet()){
                //cast the key to string
                String key = String.valueOf(recMapKey);
                System.debug('Key: ' + key + ' & value: ' + record.get(key));
                
                //if null value skip this field updation
                if(record.get(key) == null || record.get(key) == ''){
                    System.debug('!!!Skipping Updation of Key: ' + key + ' & value: ' + record.get(key) + ' !!!');
                    continue;
                }
                
                //before put - consider the type and cast likewise (STRING -> DOUBLE, BOOLEAN, INTEGER, DATE, DATETIME)
                Schema.DescribeFieldResult dfr = oSObjectType.getDescribe().fields.getMap().get(key).getDescribe();
                
                //--------------- Field Security Check Starts ---------------
                
                //Check Field Accessibility & Updatability
                Boolean isFieldAccessible = dfr.isAccessible();
                if(!isFieldAccessible)
                    throw new AuraHandledException(record.get(key) + ' is not accessible');
                
                Boolean isFieldUpdateable = dfr.isUpdateable() || dfr.isCreateable();
                if(!isFieldUpdateable && key != 'Id')
                    throw new AuraHandledException(key + ' is not updateable');
                
                //--------------- Field Security Check Ends ---------------
                
                System.debug(String.valueOf(dfr.getType()));
                if(String.valueOf(dfr.getType()) == 'BOOLEAN'){
                    System.debug('This field is BOOLEAN\n');
                    newSObj.put(key, (Boolean)record.get(key));
                } else if(String.valueOf(dfr.getType()) == 'DATETIME' || String.valueOf(dfr.getType()) == 'DATE' ){
                    System.debug('This field is DATETIME\n');
                    String[] dates = String.valueOf(record.get(key)).split('-');
                    newSObj.put(key, Date.newInstance(Integer.valueOf(dates[0]), Integer.valueOf(dates[1]), Integer.valueOf(dates[2])));
                } else if(String.valueOf(dfr.getType()) == 'DOUBLE' || String.valueOf(dfr.getType()) == 'CURRENCY' || String.valueOf(dfr.getType()) == 'PERCENT'){
                    System.debug('This field is DOUBLE\n');
                    newSObj.put(key, Double.valueOf(record.get(key)));
                } else if(String.valueOf(dfr.getType()) == 'INTEGER'){
                    System.debug('This field is INTEGER\n');
                    newSObj.put(key, Integer.valueOf(record.get(key)));
                } else {
                    System.debug('This field is Misc:String\n');
                    newSObj.put(key, String.valueOf(record.get(key)));
                }
            }
            System.debug('@@@newSObj :: ' + newSObj);
            
            recordsToUpdate.add(newSObj);
            System.debug('<<< Object >>>\n');
        }
        
        try {
            //Upsert Check
            if(isObjectUpdateable && isObjectCreatable && isObjectAccessible){
                upsert recordsToUpdate;
                System.debug('@@@Upserted Succesfully');
                return 'Success: record updated successfully';
            } else {
                throw new AuraHandledException(objectApiName + ' is not updateable or creatable');
            }
        }
        catch (Exception e) {
            System.debug(e.getMessage());
            String errMessage = '';
            if(e.getMessage().containsAny('error:')){
                errMessage = e.getMessage().substringAfter('error:');
                throw new AuraHandledException(errMessage);
            }
            
            throw new AuraHandledException('The following exception has occurred: ' + e.getMessage());
        }
    }
    
    /**
* @description deleteRecord - To Delete Record of any object
* @author Anand Dasani
* @param  toDeleteId    record Id to delete
* @param  objectApiName Name of Object to update
* @return               return success message otherwise error message
*/
    @AuraEnabled
    public static String deleteRecord(String toDeleteId, String objectApiName){
        
        System.debug('@@@deleteRecord ::: ' + objectApiName);
        
        //--------------- Security Check Starts ---------------
        
        objectAPIName = String.isNotBlank(objectAPIName) ? String.escapeSingleQuotes(objectAPIName) : objectAPIName;
        
        //ObjectApiName Check
        Boolean isValidSObjectType = Schema.getGlobalDescribe().containsKey(objectApiName);
        if(!isValidSObjectType)
            throw new AuraHandledException('Invalid input of ObjectApiName: ' + objectApiName);
        
        //Accessibility Check
        Boolean isObjectAccessible = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isAccessible();
        if(!isObjectAccessible)
            throw new AuraHandledException(objectApiName + ' is not accessible');
        
        //Delete Check
        Boolean isObjectDeletable = Schema.getGlobalDescribe().get(objectApiName).getDescribe().isDeletable();
        if(!isObjectDeletable)
            throw new AuraHandledException(objectApiName + ' is not updateable');
        
        //--------------- Security Check Ends ---------------
        
        List<sObject> sObjListToDelete = new List<sObject>();
        
        sObject sObj = Schema.getGlobalDescribe().get(objectApiName).newSObject(toDeleteId);
        sObjListToDelete.add(sObj);
        
        Database.DeleteResult[] drList = Database.delete(sObjListToDelete, false);
        List<String> deletedIds = new List<String>();
        List<String> errorMessages = new List<String>();
        // Iterate through each returned result
        for(Database.DeleteResult dr : drList) {
            if (dr.isSuccess()) {
                // Operation was successful, so get the ID of the record that was processed
                System.debug('Successfully deleted with ID: ' + dr.getId());
                deletedIds.add(dr.getId());
            }
            else {
                // Operation failed, so get all errors
                for(Database.Error err : dr.getErrors()) {
                    System.debug('The following error has occurred.');
                    System.debug(err.getStatusCode() + ': ' + err.getMessage());
                    System.debug('fields that affected this error: ' + err.getFields());
                    errorMessages.add(err.getMessage());
                }
                
            }
        }
        if(deletedIds.size() > 0)
            return 'success';
        else
            return errorMessages[0];
    }
    
    //TODO: Remove this method - non useable
    /*@AuraEnabled
public static sObject recordNameFromID(Id recordId) {
//TODO: Error in this line - trying to de-reference null object
String objectApiName = recordId.getSobjectType().getDescribe().getName();
System.debug('recordNameFromID::: Object API Name' + objectApiName);

Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
Map<String, Schema.SObjectField> fields = objectType.getDescribe().fields.getMap();

String query = '';
List<SObject> queryResults = new List<sObject>();

for(Schema.SObjectField fieldRef : fields.values()) {

Schema.DescribeFieldResult dfr = fieldRef.getDescribe();
if(dfr.isNameField()){
//Query - SELECT Name FROM Contact WHERE Id = recordId
String nameFiled = String.valueOf(dfr.getName());
query = 'SELECT Id ' + nameFiled + ' FROM ' + objectApiName + ' WHERE Id =: ' + recordId + ' LIMIT 1';
break;
}
}

if(query != null && query != ''){
try {
queryResults = Database.query(query);
System.debug('Query Results is ::: ' + queryResults);
} catch (Exception e) {
System.debug(e);
queryResults = new List<sObject>();
}
}

if(queryResults.size() > 0 && queryResults != null)
return queryResults[0];
else
return null;
}*/
    
    /**
* @description validateUserGivenForegienKey Checks whether the field is valid and lookup?
* @author Author Name
* @param  objApiName objectApiName Name of Object
* @param  foregienKeyName  fieldApiName Name of Object
* @return               return true if the field is valid and lookup
*/
    private static void validateUserGivenForegienKey(String objApiName, String foregienKeyName) {
        //get the object describe
        Schema.SObjectType oSObjectType = Schema.getGlobalDescribe().get(objApiName);
        
        Boolean fieldExistInObject = oSObjectType.getDescribe().fields.getMap().containsKey(foregienKeyName);
        if(!fieldExistInObject)
            throw new AuraHandledException(foregienKeyName + ' not found in ' + objApiName);
        
        Schema.DescribeFieldResult dfr = oSObjectType.getDescribe().fields.getMap().get(foregienKeyName).getDescribe();
        
        Boolean isFieldAccessible = dfr.isAccessible();
        if(!isFieldAccessible)
            throw new AuraHandledException(foregienKeyName + ' is not accessible');
        
        String isFieldLookup = getLightningDatatypeEquivalent(String.valueOf(dfr.getType()), dfr);
        if(!isFieldLookup.equalsIgnoreCase('lookup'))
            throw new AuraHandledException(foregienKeyName + ' is a Lookup field');
    }

    /*@AuraEnabled
    public static void addProductDefaults(String sObjectApiNames, String recordId, String childsObjectApiNames) {
        // Validate input
        System.debug('Dynamic Add Product Defaults => Parent Object: ' + sObjectApiNames + 
                    ', RecordId: ' + recordId + ', Child Object: ' + childsObjectApiNames);
        if (String.isBlank(sObjectApiNames) || String.isBlank(recordId) || String.isBlank(childsObjectApiNames)) {
            throw new AuraHandledException('Invalid input: sObjectApiNames, recordId, and childsObjectApiNames are required.');
        }


        // Dynamically query the parent record
        String soql = 'SELECT Id, To_Account__c FROM ' + sObjectApiNames + ' WHERE Id = :recordId LIMIT 1';
        SObject parentRecord = Database.query(soql);

        System.debug('parentRecord :: ' + parentRecord);

        Id accountId = (Id) parentRecord.get('To_Account__c');
        System.debug('Account ID: ' + accountId);

        if (accountId == null) {
            System.debug('No Account__c found for this record.');
            return;
        }

        List<Product_Default__c> accProductDefaults = [
            SELECT Id, Name, Account__c, Product__c, Standard_Price__c, 
                Tax_Group__c, Product__r.Description, Company__c, Product__r.Sub_Ledger__c
            FROM Product_Default__c
            WHERE Account__c = :accountId
            WITH SECURITY_ENFORCED
        ];

        if (accProductDefaults.size() == 0) {
            System.debug('No Product Defaults found for this Account: ' + accountId);
            return;
        }

        // Calculate Tax, Net, Gross
        Decimal calcTax = getVATRecords(accProductDefaults[0].Tax_Group__c);
        Decimal taxAmount = (calcTax * accProductDefaults[0].Standard_Price__c) / 100;
        Decimal grossAmount = accProductDefaults[0].Standard_Price__c + taxAmount;

        System.debug('calcTax :: ' + calcTax);
        System.debug('taxAmount :: ' + taxAmount);

        System.debug('accProductDefaults :: ' + accProductDefaults);

        Map<String, Schema.SObjectType> globalDesc = Schema.getGlobalDescribe();
        Schema.SObjectType childObjType = globalDesc.get(childsObjectApiNames);

        if (childObjType == null) {
            throw new AuraHandledException('Invalid child object name: ' + childsObjectApiNames);
        }

        // Security checks
        if (!childObjType.getDescribe().isCreateable()) {
            throw new AuraHandledException('You do not have create access on: ' + childsObjectApiNames);
        }

        List<SObject> recordsToInsert = new List<SObject>();

        for (Product_Default__c productDefault : accProductDefaults) {
            SObject childRecord = childObjType.newSObject();

            // Dynamically assign field values
            childRecord.put('Sales_Invoice__c', recordId);
            childRecord.put('Product__c', productDefault.Product__c);
            childRecord.put('Company__c', productDefault.Company__c);
            childRecord.put('Tax_Group__c', productDefault.Tax_Group__c);
            childRecord.put('Unit_Price__c', productDefault.Standard_Price__c);
            childRecord.put('Sub_Ledger__c', productDefault.Product__r.Sub_Ledger__c);
            childRecord.put('Net_Amount__c', productDefault.Standard_Price__c);
            childRecord.put('Tax_Amount__c', taxAmount);
            childRecord.put('Gross_Amount__c', grossAmount);

            recordsToInsert.add(childRecord);
        }

        if (!recordsToInsert.isEmpty()) {
            insert recordsToInsert;
            System.debug(recordsToInsert.size() + ' ' + childsObjectApiNames + ' records inserted successfully.');
    
            // Return success message with count
            return recordsToInsert.size() + ' record(s) inserted successfully into ' + childsObjectApiNames;
        }
    
        return 'No records were inserted.';
    }*/

    @AuraEnabled
    public static List<SObject> addProductDefaults(String sObjectApiNames, String recordId, String childsObjectApiNames) {
        System.debug('Dynamic Add Product Defaults => Parent Object: ' + sObjectApiNames + 
                    ', RecordId: ' + recordId + ', Child Object: ' + childsObjectApiNames);

        // ===== STEP 0: Validate input =====
        if (String.isBlank(sObjectApiNames) || String.isBlank(recordId) || String.isBlank(childsObjectApiNames)) {
            throw new AuraHandledException('Invalid input: sObjectApiNames, recordId, and childsObjectApiNames are required.');
        }

        // ===== STEP 1: Dynamically query parent record =====
        String parentQuery = 'SELECT Id, To_Account__c FROM ' + sObjectApiNames + ' WHERE Id = :recordId LIMIT 1';
        SObject parentRecord = Database.query(parentQuery);

        if (parentRecord == null || parentRecord.get('To_Account__c') == null) {
            System.debug('No valid To_Account__c found for parent record.');
            return new List<SObject>(); // Return empty list
        }

        Id accountId = (Id) parentRecord.get('To_Account__c');
        System.debug('Account ID: ' + accountId);
        System.debug('parentQuery: ' + parentQuery);
        System.debug('parentRecord: ' + parentRecord);

        // ===== STEP 2: Query Product Defaults =====
        List<Product_Default__c> accProductDefaults = [
            SELECT Id, Name, Account__c, Product__c, Standard_Price__c, 
                Tax_Group__c, Product__r.Description, Company__c, Product__r.Sub_Ledger__c
            FROM Product_Default__c
            WHERE Account__c = :accountId
            WITH SECURITY_ENFORCED
        ];

        if (accProductDefaults.isEmpty()) {
            System.debug('No Product Defaults found for Account: ' + accountId);
            return new List<SObject>(); // Return empty list
        }

        System.debug('accProductDefaults :: ' + accProductDefaults);

        // ===== STEP 3: Setup Child Object Metadata =====
        Map<String, Schema.SObjectType> globalDesc = Schema.getGlobalDescribe();
        Schema.SObjectType childObjType = globalDesc.get(childsObjectApiNames);

        if (childObjType == null) {
            throw new AuraHandledException('Invalid child object name: ' + childsObjectApiNames);
        }

        if (!childObjType.getDescribe().isCreateable()) {
            throw new AuraHandledException('You do not have create access on: ' + childsObjectApiNames);
        }

        // ===== STEP 4: Create Child Records =====
        List<SObject> recordsToInsert = new List<SObject>();

        for (Product_Default__c productDefault : accProductDefaults) {
            Decimal calcTax = getVATRecords(productDefault.Tax_Group__c);
            Decimal taxAmount = (calcTax * productDefault.Standard_Price__c) / 100;
            Decimal grossAmount = productDefault.Standard_Price__c + taxAmount;

            SObject childRecord = childObjType.newSObject();
            childRecord.put(sObjectApiNames, recordId);
            childRecord.put('Product__c', productDefault.Product__c);
            childRecord.put('s2p3__Quantity__c', 1);
            childRecord.put('Company__c', productDefault.Company__c);
            childRecord.put('Tax_Group__c', productDefault.Tax_Group__c);
            childRecord.put('Unit_Price__c', productDefault.Standard_Price__c);
            childRecord.put('Sub_Ledger__c', productDefault.Product__r.Sub_Ledger__c);
           // if (sObjectApiNames == 's2p3__Sales_Invoice__c') {                
                childRecord.put('Net_Amount__c', productDefault.Standard_Price__c);
                childRecord.put('Gross_Amount__c', grossAmount);
           // }
            childRecord.put('Tax_Amount__c', taxAmount);

            recordsToInsert.add(childRecord);
        }

        // ===== STEP 5: Insert and Return =====
        if (!recordsToInsert.isEmpty()) {
            insert recordsToInsert;
            System.debug(recordsToInsert.size() + ' ' + childsObjectApiNames + ' records inserted successfully.');
        }

        return recordsToInsert; // Always return list (can be empty or with inserted records)
    }
    
    /**
* @description getLightningDatatypeEquivalent - Return the data type equivalent to salesforce custom fields
* @author Anand Dasani
* @param  field Field to consider for data type
* @param  dfr   Schema.DescribeFieldResult for additional detials of fields if reqired
* @return       return equivalent data type supported by the SF & JS - general
*/
    private static String getLightningDatatypeEquivalent(String field,  Schema.DescribeFieldResult dfr) {
        String dataType;
        System.debug('getLightningDatatypeEquivalent :: ' + field);
        switch on field.toLowerCase() {
            when 'string', 'id' {
                dataType = 'text';
            }
            when 'boolean' {
                dataType = 'boolean';
            }
            when 'currency' {
                dataType = 'currency';
            }
            when 'date' {
                dataType = 'date-local';
            }
            when 'datetime' {
                dataType = 'date';
            }
            when 'email' {
                dataType = 'email';
            }
            when 'integer', 'percent', 'double' {
                dataType = 'number';
            }
            when 'phone' {
                dataType = 'phone';
            }
            when 'textarea' {
                //check for richtext field type
                if(dfr.getType() == Schema.DisplayType.TEXTAREA && dfr.isHtmlFormatted())
                    dataType = 'richArea';
                else
                    dataType = 'areaLong';
            }
            when 'url' {
                dataType = 'url';
            }
            when 'combobox', 'picklist' {
                //dataType = 'checkbox';
                if(dfr.isDependentPicklist())
                    dataType = 'dependentPicklist';
                else
                    dataType = 'checkbox';
            }
            when 'reference' {
                dataType = 'lookup';
            }
            when 'multipicklist' {
                dataType = 'MultiSelect-Piklist';
            }
            when 'address' {
                dataType = 'address';
            }
            when 'time' {
                dataType = 'time';
            }
            when else {
                dataType = 'misc';
            }
        }
        return dataType;
    }
    
    /**
* Wrapper class for sending chunk of result to JS
*/
    public class fieldSetDetails {
        @AuraEnabled
        public String label {get;set;}
        @AuraEnabled
        public String fieldName {get;set;}
        @AuraEnabled
        public String type {get;set;}
        @AuraEnabled
        public Boolean sortable {get; set;}
        @AuraEnabled
        public Boolean editable {get; set;}
        @AuraEnabled
        public Boolean required {get; set;}
        @AuraEnabled
        public String referenceTo {get; set;}
        
        //Create and set three variables label, fieldname and type as required by the lightning:datatable
        public fieldSetDetails(String label, String fieldName, String type, Boolean editable,Boolean required, String referenceTo) {
            this.label = label;
            this.fieldName = fieldName;
            this.type = type;
            this.editable = editable;
            this.required = required;
            this.referenceTo = referenceTo;
            //this.sortable = sortable;
        }
    }
}