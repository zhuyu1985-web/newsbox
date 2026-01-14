## ADDED Requirements

### Requirement: Payment order creation
The system SHALL create payment orders and generate z-pay payment URLs.

#### Scenario: Create Pro subscription order
- **WHEN** a logged-in user selects the Pro plan and clicks pay
- **THEN** the system creates an order with amount ¥9.9 and plan_type 'pro'
- **AND** generates a unique out_trade_no
- **AND** returns a z-pay payment URL with proper signature

#### Scenario: Create AI subscription order
- **WHEN** a logged-in user selects the AI plan and clicks pay
- **THEN** the system creates an order with amount ¥19.9 and plan_type 'ai'
- **AND** generates a unique out_trade_no
- **AND** returns a z-pay payment URL with proper signature

#### Scenario: Support multiple payment methods
- **WHEN** a user initiates payment
- **THEN** the system supports both Alipay (alipay) and WeChat Pay (wxpay)
- **AND** the selected payment method is passed to z-pay

#### Scenario: Unauthenticated user redirect
- **WHEN** an unauthenticated user clicks a payment button
- **THEN** the system redirects to the login page
- **AND** after login, the user can return to complete payment

### Requirement: Payment signature generation
The system SHALL generate MD5 signatures for z-pay requests following the z-pay signature algorithm.

#### Scenario: Generate payment signature
- **WHEN** preparing a payment request
- **THEN** the system sorts all parameters by key (ASCII order)
- **AND** concatenates as key=value&key2=value2 format
- **AND** appends the merchant key and generates MD5 hash
- **AND** excludes sign, sign_type, and empty values from signature

### Requirement: Payment callback handling
The system SHALL handle z-pay payment notifications securely and idempotently.

#### Scenario: Successful payment notification
- **WHEN** z-pay sends a callback with trade_status = TRADE_SUCCESS
- **THEN** the system verifies the signature
- **AND** checks if the order exists and amount matches
- **AND** updates order status to 'paid'
- **AND** activates or extends user membership
- **AND** returns "success" to z-pay

#### Scenario: Signature verification failure
- **WHEN** a callback has an invalid signature
- **THEN** the system rejects the callback
- **AND** logs the security event
- **AND** does not modify any data

#### Scenario: Idempotent callback handling
- **WHEN** z-pay sends duplicate callbacks for the same order
- **THEN** the system detects the order is already paid
- **AND** returns "success" without re-processing
- **AND** does not grant duplicate membership time

#### Scenario: Order amount mismatch
- **WHEN** the callback amount differs from the stored order amount
- **THEN** the system rejects the callback
- **AND** logs the discrepancy for investigation

### Requirement: Payment return page
The system SHALL handle the browser redirect after payment completion.

#### Scenario: Successful payment redirect
- **WHEN** a user completes payment and is redirected to return_url
- **THEN** the system verifies the signature
- **AND** redirects to /dashboard with success message
- **AND** displays "订阅成功！感谢您的支持"

#### Scenario: Payment status polling fallback
- **WHEN** the callback has not been received within 30 seconds
- **THEN** the frontend can poll the order status API
- **AND** refreshes membership status when order is confirmed paid

### Requirement: Order management
The system SHALL maintain order records for auditing and customer support.

#### Scenario: Order status tracking
- **WHEN** an order is created
- **THEN** the system stores: user_id, out_trade_no, plan_type, amount, status, pay_type, created_at
- **AND** updates trade_no and paid_at when payment is confirmed

#### Scenario: Order history query
- **WHEN** a user or admin queries order history
- **THEN** the system returns orders for the user with status and dates
- **AND** respects RLS policies for data access

### Requirement: Pricing page integration
The system SHALL display accurate pricing and enable payment from the pricing page.

#### Scenario: Display subscription options
- **WHEN** a user visits /pricing
- **THEN** the page shows NewsBox Pro at ¥9.9/year
- **AND** shows NewsBox AI at ¥19.9/year
- **AND** highlights AI plan as recommended

#### Scenario: Logged-in user payment flow
- **WHEN** a logged-in user clicks a subscription button
- **THEN** the system shows payment method selection (Alipay/WeChat)
- **AND** initiates payment and redirects to z-pay

#### Scenario: Show current membership status
- **WHEN** a logged-in user visits /pricing
- **THEN** the page shows their current plan and expiration date
- **AND** adjusts button text accordingly (e.g., "续费" vs "升级")
