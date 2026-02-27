VM instance pricing
General-purpose machine type family
Compute-optimized machine type family
Memory-optimized machine type family
Storage-optimized machine type family
Accelerator-optimized machine type family
Shared-core machine types
Tier_1 higher bandwidth network pricing
Simulated maintenance event pricing
Suspended VM instances
Confidential VM instances
What's next
VM instance pricing
This page describes the cost of running a Compute Engine VM instance with any of the following machine types, as well as other VM instance-related pricing. To see the pricing for other Google Cloud products, see the Google Cloud pricing list.

Note: This page covers the cost of running a VM instance. It does not cover pricing for any disk and images, networking, sole tenancy, Confidential VM service, or GPUs used by the VM instance.

Compute Engine charges for usage based on the following price sheet. A bill is sent out at the end of each billing cycle, providing a sum of Google Cloud charges. Prices on this page are listed in U.S. dollars (USD).

For Compute Engine, disk size, machine type memory, and network usage are calculated in JEDEC binary gigabytes (GB), or IEC gibibytes (GiB), where 1 GiB is 230 bytes. Similarly, 1 TiB is 240 bytes, or 1024 JEDEC GBs.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

You can also find pricing information with the following options:

See the estimated costs of your instances and Compute Engine resources when you create them in the Google Cloud console.
Estimate your total project costs with the Google Cloud Pricing Calculator.
View and download prices from the Pricing Table in the Google Cloud console.
View more information about costs and usage in Cloud Billing reports.
Use the Cloud Billing Catalog API for programmatic access to SKU information.
Billing model
The following billing model applies to all vCPUs, GPUs, and memory resources. The billing model also applies to several premium images that you run on Compute Engine instances.

All vCPUs, GPUs, and GB of memory are charged a minimum of 1 minute. For example, if you run your virtual machine for 30 seconds, you will be billed for 1 minute of usage.
After 1 minute, instances are charged in 1 second increments.
Instance uptime
Instance uptime is measured as the number of seconds between when you start an instance and when you stop an instance, the latter being when the instance state is STOPPING. In some cases, your instance can suffer from a failure and be marked as STOPPING by the system; in these cases, you will not be charged for usage after the instance reaches the STOPPING state. If an instance is idle, but still has a state of RUNNING, it will be charged for instance uptime. The easiest way to determine the status of an instance is to use gcloud compute with the gcloud compute instances list command or to visit the Google Cloud console.

In the case of reservations, instance uptime is measured as the number of seconds between when you create a reservation and when you delete that reservation. Reserved resources are billed at standard rates, whether they are started or not.

Note that Compute Engine bills for a minimum of 1 minute of usage, so if you use an instance for 30 seconds of uptime, you are billed for 1 minute. After 1 minute, your instance is billed on a per-second basis. For more information, see the billing model.

Note: If you are a Microsoft licensee with a contract that includes Software Assurance, you might be able to move your existing SQL Server licenses to Compute Engine, instead of paying a per-hour license fee. To find out more information about License Mobility, see the documentation for Using Existing Microsoft Licenses.

Resource-based pricing
Each vCPU and each GB of memory on Compute Engine is billed separately rather than as part of a single machine type. You still create instances using predefined machine types, but your bill reports them as individual vCPUs and memory used per hour. If you change the number of threads per core, you are billed for the number of vCPUs defined by a VM's machine type, not the number of threads used by the VM.

The pricing tables in the machine family and machine type sections on this page describe prices for machine types based on vCPU and memory resources, but also include the calculated cost for each machine type. You can also use the Google Cloud Pricing Calculator to better understand prices for different configurations.

Discounts
vCPU and memory usage for each machine type use the on-demand price unless that usage qualifies for a discount. vCPU and memory usage for each machine type can receive one of the following discounts:

Spot prices: automatic discounts for all Spot VMs (and preemptible VMs), which typically offer the largest discounts—up to 91% off of the corresponding on-demand price—are listed separately on the Spot VMs pricing page.
Note: Spot prices can change up to once every 30 days and don't appear in most pricing tables for Compute Engine. For the latest prices, see the Spot VMs pricing page.
Committed use discounts (CUDs): up to a 70% discount for memory-optimized machine types and up to a 55% discount for all other machine types.
Sustained use discounts (SUDs): automatic discount of up to 30% on resources that are used for more than 25% of a month and are not receiving any other discounts.
Discount types cannot be combined. For more information, see Order of discount application.


Spot prices
Spot prices are variable and can change up to once every day, but provide discounts of up to 91% off of the corresponding default price for many machine types, GPUs, TPUs, and Local SSDs. Spot prices are automatically applied to all Spot VMs and preemptible VMs. However, Compute Engine can preempt Spot VMs and preemptible VMs at any time, so they are only recommended for fault-tolerant applications that can handle VM preemption.

For the latest prices, see the Spot VMs pricing page.

For more information, see the documentation for Spot VMs.



Committed use discounts
Compute Engine offers resources at deeply discounted prices in return for purchasing committed use contracts (also known as commitments). When you purchase a commitment, you commit either to a minimum amount of resource usage or to a minimum spend amount for a specified term of one or three years.

Depending on your resource usage requirements, you can purchase 1-year or 3-year commitments and receive CUDs for Compute Engine resources in either of the following ways:

Resource-based committed use discounts: You receive these CUDs when you purchase a resource-based commitment and commit to use a minimum level of Compute Engine resources in a particular region.
Compute flexible committed use discounts: You avail Compute flexible CUDs when you purchase a spend-based Compute flexible commitment and commit to a minimum amount of hourly spend.


Resource-based CUDs
Compute Engine offers a flat committed use discount percentage on its VMs across all regions. When you purchase vCPUs, memory, or both on a 1-year commitment, you get the resources at a discount of 37% over the on-demand prices. When you purchase your resources on a 3-year commitment, the discount increases to 70% over the on-demand prices for memory-optimized machine types and to 55% over the on-demand prices for all other machine types.

Resource-based CUDs are available for the following machine types in each machine family, with the exception of Memory Optimized Upgrade Premium SKUs:

General purpose:
All general purpose machine types except for N1 shared-core machine types
All N1, N2, N2D, N4, C3, C3D, C4, C4A and C4D sole-tenant nodes
Memory-optimized:
All M1, M2, M3, machine types
All M1, M2, M3, sole-tenant node types
Compute-optimized:
All compute-optimized (C2, C2D, and H3) machine types
All C2 and H3 sole-tenant node types
Storage-optimized:
All Z3 machine types
Accelerator-optimized:
All A2, A3, and G2 machine types
All G2 sole-tenant node types
For a more detailed breakdown, see Commitment types.



Combine reservations with committed use discounts
A commitment provides a 1- or 3-year discounted price agreement, but it does not reserve capacity in a specific zone. A reservation ensures that capacity is held in a specific zone even if the reserved VMs are not running. To get zonal resources at discounted prices and also ensure that capacity is reserved for them, you must do both of the following: purchase commitments and create reservations for those zonal resources.

You can also attach reservations to your resource-based commitments to ensure that Compute Engine reserves capacity for your committed resources. When you commit to GPU or Local SSD resources, you must also reserve those resources and attach those reservations to your commitment.

For more information, see Combine reservations with committed use discounts.



Purchase resource-based commitments
To learn how to purchase resource-based commitments, see the following:

Purchase commitments without attached reservations
Purchase commitments with attached reservations


Pricing for resource-based commitments
After you purchase a resource-based commitment, you're billed monthly for your commitment and must pay your monthly commitment fee even if you don't use all of your committed resources. Your commitment fee is the sum of the discounted prices of all your committed resources. Compute Engine calculates the discounted price of each resource by using its prevailing on-demand price on the day your commitment becomes active. Your monthly commitment fee and the discounted prices for your resources stay the same until the end of your commitment term, even if the on-demand prices change.

If you use your commitments to run custom machine types, then Compute Engine charges a 5% premium over the commitment prices. Compute Engine charges this premium for the portion and duration of your commitment that you run these custom machine type VMs.

Note: If you merge or split your commitments, then the discounted prices for your committed resources might change on the day your merged or split commitments become active.


Compute flexible CUDs
Compute flexible CUDs are spend-based CUDs that you receive when you commit to a minimum amount of hourly spend on one or more of the following services:

Compute Engine
Google Kubernetes Engine
Cloud Run
For Compute Engine, you can receive flexible CUDs for your vCPU and memory usage in any of the projects within your Cloud Billing account, across any region, and belonging to any eligible machine types.

You purchase flexible commitments for your Cloud Billing account and commit to a minimum hourly spend amount across these products for a 1-year or 3-year term duration. Specifically, you commit to spend on eligible resources or services that are worth a specified minimum amount of on-demand price, per hour, throughout the commitment's term. Depending on your commitment's term, you receive the following CUDs on that minimum hourly spend amount:

A 28% discount over your committed hourly spend amount for a 1-year commitment
A 46% discount over your committed hourly spend amount for a 3-year commitment
Note: The discounts that you receive may differ for Cloud Billing accounts that have other on-demand VM savings in effect.

Your commitment becomes active within the first hour of its purchase. This discounted committed spend amount becomes your hourly commitment fee. In return, you receive hourly credits on your Cloud Billing account that are worth your total committed spend amount. Google Cloud uses these credits to offset your hourly spend on usage that is eligible for flexible CUDs. At the end of each month, Google Cloud calculates your total commitment fee for that month and bills you that amount.

Your hourly commitment fee remains your minimum hourly expenditure throughout the commitment term and you have to pay it even if you don't use resources whose on-demand prices total up to your committed hourly spend. Your commitment fee remains the same even if the on-demand prices for your resources change during your commitment term.

Important: A single flexible commitment covers your eligible spend across Compute Engine, GKE, and Cloud Run . For any given flexible commitment, the credits from flexible CUDs that you receive are distributed across these services in proportion to their individual eligible spend amounts. Depending on whether your Google Cloud usage is limited to Compute Engine or also spans across these other services, you might see differences in the flexible CUD credits that you receive for your commitment.

For Compute Engine, only memory and vCPUs of the following machine series are eligible for flexible CUDs. For every listed machine series, all available machine types and sole-tenant node types are eligible.

General purpose: C3, C3D, C4, C4A, C4D, E2, N1, N2, N2D, N4, N4, N4D, and N4A.
Compute-optimized:
H3 and H4D machine series (Available only after opting in to the new model)
C2 and C2D machine series
Memory-optimized: M1, M2, M3, and M4 machine series (Available only after opting in to the new model)
Storage-optimized: Z3 machine series
For more information, see the following documents:

To learn more about flexible CUDs, see Compute flexible CUDs.
To learn how to purchase spend-based commitments, see Purchasing spend-based commitments.
To view the full list of Compute Engine SKUs that are eligible for flexible CUDs, see Compute flexible CUDs eligible SKUs.
To learn how to view, analyze, and manage your spend-based commitments, see Analyze the effectiveness of flexible commitments.

Sustained use discounts
Compute Engine offers sustained use discounts (SUDs) on resources that are used for more than 25% of a billing month and are not receiving any other discounts. Whenever you use an applicable resource for more than a fourth of a billing month, you automatically receive a discount for every incremental hour that you continue to use that resource. The discount increases incrementally with usage and you can get up to a 30% net discount off of the resource cost for virtual machine (VM) instances that run the entire month.

Compute Engine automatically calculates and applies SUDs to resource usage within a Cloud Billing account, so there is no action required on your part to enable these discounts.

You receive SUDs in the form of monthly credits. At the end of every month, for every eligible Compute Engine resource that you use, you receive applicable SUDs as credits based on the duration of time for which you used that resource. Any credits that you receive for your SUDs have no cash value. Compute Engine uses these credits to offset your monthly resource usage costs. You can't store or use these credits beyond the month in which you receive them.

To learn more about sustained use discounts, see the SUDs documentation.

You can view all your earned credits during a particular month in the cost table report for your Cloud Billing account on the Google Cloud console. To learn more about credits and how to view them, see View and analyze your credits.



Order of discount application
You can purchase both resource-based and flexible commitments to cover Compute Engine resources for projects within your Cloud Billing account. However, the discount types that Google Cloud offers on your Compute Engine resources are mutually exclusive and can't be combined. At any given point, a resource is eligible for only one kind of discount. If you're receiving a specific type of discount for a portion of your resource usage, then that portion of usage doesn't qualify for any other type of discount.

You can use your resource-based commitments to cover your predictable and stable resource usage that is specific to a project, region, and a machine series. You can use flexible commitments to cover any resource usage that isn't specific to any one machine series, project, or region. If you purchase both resource-based commitments and flexible commitments for your Compute Engine resources, then Google Cloud optimizes the use of your commitments, on an hourly basis, in the following way:

Google Cloud first utilizes your resource-based commitments and applies all the resulting resource-based CUDs to any eligible hourly usage.
Google Cloud then utilizes your spend-based commitments and applies all the resulting flexible CUDs to any remaining eligible on-demand usage.
After utilizing all of your commitments, Google Cloud uses the on-demand rates to charge any additional hourly usage. This overage hourly usage might be eligible for any applicable SUDs.

Additionally, spot prices apply to all Spot VMs (and preemptible VMs), so Spot VMs (and preemptible VMs) cannot receive CUDs or SUDs.

The pricing tables in the machine family and machine type sections on this page compare the on-demand prices for machine types in each machine family with the discounted prices for each of the following:

Spot VMs (and preemptible VMs)
1-year resource-based commitments
3-year resource-based commitments
1-year flexible CUD consumption rates
3-year flexible CUD consumption rates
Viewing usage
The Google Cloud console provides a transaction history for each of your projects. This history describes your current balance and estimated resource usage for that particular project.

To view a project's transaction history, go to the estimated billing invoice page.

General-purpose machine type family
General-purpose machine-types offer predefined and custom machine types in each region. Predefined machine types have a preset number of vCPUs and amount of memory, but are billed using the resource-based pricing model. Custom machine types are billed according to the resource-based pricing.

Not all machine types are available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

C4 machine types

C4 standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4-standard-2

2

7 GiB

$0.096866 / 1 hour	$0.06974352 / 1 hour	$0.05230764 / 1 hour	$0.061027 / 1 hour	$0.04359 / 1 hour
c4-standard-4

4

15 GiB

$0.19767 / 1 hour	$0.1423224 / 1 hour	$0.1067418 / 1 hour	$0.124535 / 1 hour	$0.088952 / 1 hour
c4-standard-8

8

30 GiB

$0.39534 / 1 hour	$0.2846448 / 1 hour	$0.2134836 / 1 hour	$0.24907 / 1 hour	$0.177904 / 1 hour
c4-standard-16

16

60 GiB

$0.79068 / 1 hour	$0.5692896 / 1 hour	$0.4269672 / 1 hour	$0.49814 / 1 hour	$0.355808 / 1 hour
c4-standard-24

24

90 GiB

$1.18602 / 1 hour	$0.8539344 / 1 hour	$0.6404508 / 1 hour	$0.74721 / 1 hour	$0.533712 / 1 hour
c4-standard-32

32

120 GiB

$1.58136 / 1 hour	$1.1385792 / 1 hour	$0.8539344 / 1 hour	$0.99628 / 1 hour	$0.711616 / 1 hour
c4-standard-48

48

180 GiB

$2.37204 / 1 hour	$1.7078688 / 1 hour	$1.2809016 / 1 hour	$1.49442 / 1 hour	$1.067424 / 1 hour
c4-standard-96

96

360 GiB

$4.74408 / 1 hour	$3.4157376 / 1 hour	$2.5618032 / 1 hour	$2.98884 / 1 hour	$2.134848 / 1 hour
c4-standard-144

144

540 GiB

$7.11612 / 1 hour	$5.1236064 / 1 hour	$3.8427048 / 1 hour	$4.48326 / 1 hour	$3.202272 / 1 hour
c4-standard-192

192

720 GiB

$9.48816 / 1 hour	$6.8314752 / 1 hour	$5.1236064 / 1 hour	$5.97768 / 1 hour	$4.269696 / 1 hour
c4-standard-288

288

1080 GiB

$14.23224 / 1 hour	$10.2472128 / 1 hour	$7.6854096 / 1 hour	$8.96652 / 1 hour	$6.404544 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4 high-memory machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4-highmem-2

2

15 GiB

$0.12837 / 1 hour	$0.0924264 / 1 hour	$0.0693198 / 1 hour	$0.080875 / 1 hour	$0.057766 / 1 hour
c4-highmem-4

4

31 GiB

$0.260678 / 1 hour	$0.18768816 / 1 hour	$0.14076612 / 1 hour	$0.164231 / 1 hour	$0.117304 / 1 hour
c4-highmem-8

8

62 GiB

$0.521356 / 1 hour	$0.37537632 / 1 hour	$0.28153224 / 1 hour	$0.328462 / 1 hour	$0.234608 / 1 hour
c4-highmem-16

16

124 GiB

$1.042712 / 1 hour	$0.75075264 / 1 hour	$0.56306448 / 1 hour	$0.656924 / 1 hour	$0.469216 / 1 hour
c4-highmem-24

24

186 GiB

$1.564068 / 1 hour	$1.12612896 / 1 hour	$0.84459672 / 1 hour	$0.985386 / 1 hour	$0.703824 / 1 hour
c4-highmem-32

32

248 GiB

$2.085424 / 1 hour	$1.50150528 / 1 hour	$1.12612896 / 1 hour	$1.313848 / 1 hour	$0.938432 / 1 hour
c4-highmem-48

48

372 GiB

$3.128136 / 1 hour	$2.25225792 / 1 hour	$1.68919344 / 1 hour	$1.970772 / 1 hour	$1.407648 / 1 hour
c4-highmem-96

96

744 GiB

$6.256272 / 1 hour	$4.50451584 / 1 hour	$3.37838688 / 1 hour	$3.941544 / 1 hour	$2.815296 / 1 hour
c4-highmem-144

144

1116 GiB

$9.384408 / 1 hour	$6.75677376 / 1 hour	$5.06758032 / 1 hour	$5.912316 / 1 hour	$4.222944 / 1 hour
c4-highmem-192

192

1488 GiB

$12.512544 / 1 hour	$9.00903168 / 1 hour	$6.75677376 / 1 hour	$7.883088 / 1 hour	$5.630592 / 1 hour
c4-highmem-288

288

2232 GiB

$18.768816 / 1 hour	$13.51354752 / 1 hour	$10.13516064 / 1 hour	$11.824632 / 1 hour	$8.445888 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4 high-CPU machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4-highcpu-2

2

4 GiB

$0.085052 / 1 hour	$0.06123744 / 1 hour	$0.04592808 / 1 hour	$0.053584 / 1 hour	$0.038274 / 1 hour
c4-highcpu-4

4

8 GiB

$0.170104 / 1 hour	$0.12247488 / 1 hour	$0.09185616 / 1 hour	$0.107168 / 1 hour	$0.076548 / 1 hour
c4-highcpu-8

8

16 GiB

$0.340208 / 1 hour	$0.24494976 / 1 hour	$0.18371232 / 1 hour	$0.214336 / 1 hour	$0.153096 / 1 hour
c4-highcpu-16

16

32 GiB

$0.680416 / 1 hour	$0.48989952 / 1 hour	$0.36742464 / 1 hour	$0.428672 / 1 hour	$0.306192 / 1 hour
c4-highcpu-24

24

48 GiB

$1.020624 / 1 hour	$0.73484928 / 1 hour	$0.55113696 / 1 hour	$0.643008 / 1 hour	$0.459288 / 1 hour
c4-highcpu-32

32

64 GiB

$1.360832 / 1 hour	$0.97979904 / 1 hour	$0.73484928 / 1 hour	$0.857344 / 1 hour	$0.612384 / 1 hour
c4-highcpu-48

48

96 GiB

$2.041248 / 1 hour	$1.46969856 / 1 hour	$1.10227392 / 1 hour	$1.286016 / 1 hour	$0.918576 / 1 hour
c4-highcpu-96

96

192 GiB

$4.082496 / 1 hour	$2.93939712 / 1 hour	$2.20454784 / 1 hour	$2.572032 / 1 hour	$1.837152 / 1 hour
c4-highcpu-144

144

288 GiB

$6.123744 / 1 hour	$4.40909568 / 1 hour	$3.30682176 / 1 hour	$3.858048 / 1 hour	$2.755728 / 1 hour
c4-highcpu-192

192

384 GiB

$8.164992 / 1 hour	$5.87879424 / 1 hour	$4.40909568 / 1 hour	$5.144064 / 1 hour	$3.674304 / 1 hour
c4-highcpu-288

288

576 GiB

$12.247488 / 1 hour	$8.81819136 / 1 hour	$6.61364352 / 1 hour	$7.716096 / 1 hour	$5.511456 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4 Standard with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
VM Shape

vCPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4-standard-4-lssd

4

15 GiB

375 GiB

$0.279861781 / 1 hour	$0.201500482 / 1 hour	$0.151125362 / 1 hour	$0.176315822 / 1 hour	$0.125938301 / 1 hour
c4-standard-8-lssd

8

30 GiB

375 GiB

$0.477531781 / 1 hour	$0.343822882 / 1 hour	$0.257867162 / 1 hour	$0.300850822 / 1 hour	$0.214890301 / 1 hour
c4-standard-16-lssd

16

60

750 GiB

$0.955063562 / 1 hour	$0.687645764 / 1 hour	$0.515734323 / 1 hour	$0.601701644 / 1 hour	$0.429780603 / 1 hour
c4-standard-24-lssd

24

90 GiB

1500 GiB

$1.514787123 / 1 hour	$1.090646729 / 1 hour	$0.817985047 / 1 hour	$0.954333288 / 1 hour	$0.681657205 / 1 hour
c4-standard-32-lssd

32

120 GiB

1875 GiB

$1.992318904 / 1 hour	$1.434469611 / 1 hour	$1.075852208 / 1 hour	$1.25518411 / 1 hour	$0.896547507 / 1 hour
c4-standard-48-lssd

48

180 GiB

3000 GiB

$3.029574247 / 1 hour	$2.181293458 / 1 hour	$1.635970093 / 1 hour	$1.908666575 / 1 hour	$1.363314411 / 1 hour
c4-standard-96-lssd

96

360 GiB

6000 GiB

$6.059148493 / 1 hour	$4.362586915 / 1 hour	$3.271940186 / 1 hour	$3.817333151 / 1 hour	$2.726628822 / 1 hour
c4-standard-144-lssd

144

540 GiB

9000 GiB

$9.08872274 / 1 hour	$6.543880373 / 1 hour	$4.907910279 / 1 hour	$5.725999726 / 1 hour	$4.089943233 / 1 hour
c4-standard-192-lssd

192

720 GiB

12000 GiB

$12.118296986 / 1 hour	$8.72517383 / 1 hour	$6.543880373 / 1 hour	$7.634666301 / 1 hour	$5.453257644 / 1 hour
c4-standard-288-lssd

288

1080 GiB

18000 GiB

$18.177445479 / 1 hour	$13.087760745 / 1 hour	$9.815820559 / 1 hour	$11.451999452 / 1 hour	$8.179886466 / 1 hour
c4-standard-288-lssd-metal

288

1080 GiB

18000 GiB

$18.177445479 / 1 hour	$13.087760745 / 1 hour	$9.815820559 / 1 hour	$11.451999452 / 1 hour	$8.179886466 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4 Highmem with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
VM Shape

vCPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4-highmem-4-lssd

4

31 GiB

375 GiB

$0.342869781 / 1 hour	$0.246866242 / 1 hour	$0.185149682 / 1 hour	$0.216011822 / 1 hour	$0.154290301 / 1 hour
c4-highmem-8-lssd

8

62 GiB

375 GiB

$0.603547781 / 1 hour	$0.434554402 / 1 hour	$0.325915802 / 1 hour	$0.380242822 / 1 hour	$0.271594301 / 1 hour
c4-highmem-16-lssd

16

124 GiB

750 GiB

$1.207095562 / 1 hour	$0.869108804 / 1 hour	$0.651831603 / 1 hour	$0.760485644 / 1 hour	$0.543188603 / 1 hour
c4-highmem-24-lssd

24

186 GiB

1500 GiB

$1.892835123 / 1 hour	$1.362841289 / 1 hour	$1.022130967 / 1 hour	$1.192509288 / 1 hour	$0.851769205 / 1 hour
c4-highmem-32-lssd

32

248 GiB

1875 GiB

$2.496382904 / 1 hour	$1.797395691 / 1 hour	$1.348046768 / 1 hour	$1.57275211 / 1 hour	$1.123363507 / 1 hour
c4-highmem-48-lssd

48

372 GiB

3000 GiB

$3.785670247 / 1 hour	$2.725682578 / 1 hour	$2.044261933 / 1 hour	$2.385018575 / 1 hour	$1.703538411 / 1 hour
c4-highmem-96-lssd

96

744 GiB

6000 GiB

$7.571340493 / 1 hour	$5.451365155 / 1 hour	$4.088523866 / 1 hour	$4.770037151 / 1 hour	$3.407076822 / 1 hour
c4-highmem-144-lssd

144

1116 GiB

9000 GiB

$11.35701074 / 1 hour	$8.177047733 / 1 hour	$6.132785799 / 1 hour	$7.155055726 / 1 hour	$5.110615233 / 1 hour
c4-highmem-192-lssd

192

1488 GiB

12000 GiB

$15.142680986 / 1 hour	$10.90273031 / 1 hour	$8.177047733 / 1 hour	$9.540074301 / 1 hour	$6.814153644 / 1 hour
c4-highmem-288-lssd

288

2232 GiB

18000 GiB

$22.714021479 / 1 hour	$16.354095465 / 1 hour	$12.265571599 / 1 hour	$14.310111452 / 1 hour	$10.221230466 / 1 hour
c4-highmem-288-lssd-metal

288

2232 GiB

18000 GiB

$22.714021479 / 1 hour	$16.354095465 / 1 hour	$12.265571599 / 1 hour	$14.310111452 / 1 hour	$10.221230466 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A machine types

C4A standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4a-standard-1

1

4 GiB

$0.0449 / 1 hour	$0.032328 / 1 hour	$0.024246 / 1 hour	$0.02961 / 1 hour	$0.02021 / 1 hour
c4a-standard-2

2

8 GiB

$0.0898 / 1 hour	$0.064656 / 1 hour	$0.048492 / 1 hour	$0.05922 / 1 hour	$0.04042 / 1 hour
c4a-standard-4

4

16 GiB

$0.1796 / 1 hour	$0.129312 / 1 hour	$0.096984 / 1 hour	$0.11844 / 1 hour	$0.08084 / 1 hour
c4a-standard-8

8

32 GiB

$0.3592 / 1 hour	$0.258624 / 1 hour	$0.193968 / 1 hour	$0.23688 / 1 hour	$0.16168 / 1 hour
c4a-standard-16

16

64 GiB

$0.7184 / 1 hour	$0.517248 / 1 hour	$0.387936 / 1 hour	$0.47376 / 1 hour	$0.32336 / 1 hour
c4a-standard-32

32

128 GiB

$1.4368 / 1 hour	$1.034496 / 1 hour	$0.775872 / 1 hour	$0.94752 / 1 hour	$0.64672 / 1 hour
c4a-standard-48

48

192 GiB

$2.1552 / 1 hour	$1.551744 / 1 hour	$1.163808 / 1 hour	$1.42128 / 1 hour	$0.97008 / 1 hour
c4a-standard-64

64

256 GiB

$2.8736 / 1 hour	$2.068992 / 1 hour	$1.551744 / 1 hour	$1.89504 / 1 hour	$1.29344 / 1 hour
c4a-standard-72

72

288 GiB

$3.2328 / 1 hour	$2.327616 / 1 hour	$1.745712 / 1 hour	$2.13192 / 1 hour	$1.45512 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A high-memory machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4a-highmem-1

1

8 GiB

$0.05894 / 1 hour	$0.0424368 / 1 hour	$0.0318276 / 1 hour	$0.03885 / 1 hour	$0.02653 / 1 hour
c4a-highmem-2

2

16 GiB

$0.11788 / 1 hour	$0.0848736 / 1 hour	$0.0636552 / 1 hour	$0.0777 / 1 hour	$0.05306 / 1 hour
c4a-highmem-4

4

32 GiB

$0.23576 / 1 hour	$0.1697472 / 1 hour	$0.1273104 / 1 hour	$0.1554 / 1 hour	$0.10612 / 1 hour
c4a-highmem-8

8

64 GiB

$0.47152 / 1 hour	$0.3394944 / 1 hour	$0.2546208 / 1 hour	$0.3108 / 1 hour	$0.21224 / 1 hour
c4a-highmem-16

16

128 GiB

$0.94304 / 1 hour	$0.6789888 / 1 hour	$0.5092416 / 1 hour	$0.6216 / 1 hour	$0.42448 / 1 hour
c4a-highmem-32

32

256 GiB

$1.88608 / 1 hour	$1.3579776 / 1 hour	$1.0184832 / 1 hour	$1.2432 / 1 hour	$0.84896 / 1 hour
c4a-highmem-48

48

384 GiB

$2.82912 / 1 hour	$2.0369664 / 1 hour	$1.5277248 / 1 hour	$1.8648 / 1 hour	$1.27344 / 1 hour
c4a-highmem-64

64

512 GiB

$3.77216 / 1 hour	$2.7159552 / 1 hour	$2.0369664 / 1 hour	$2.4864 / 1 hour	$1.69792 / 1 hour
c4a-highmem-72

72

576 GiB

$4.24368 / 1 hour	$3.0554496 / 1 hour	$2.2915872 / 1 hour	$2.7972 / 1 hour	$1.91016 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A high-CPU machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4a-highcpu-1

1

2 GiB

$0.03788 / 1 hour	$0.0272736 / 1 hour	$0.0204552 / 1 hour	$0.02499 / 1 hour	$0.01705 / 1 hour
c4a-highcpu-2

2

4 GiB

$0.07576 / 1 hour	$0.0545472 / 1 hour	$0.0409104 / 1 hour	$0.04998 / 1 hour	$0.0341 / 1 hour
c4a-highcpu-4

4

8 GiB

$0.15152 / 1 hour	$0.1090944 / 1 hour	$0.0818208 / 1 hour	$0.09996 / 1 hour	$0.0682 / 1 hour
c4a-highcpu-8

8

16 GiB

$0.30304 / 1 hour	$0.2181888 / 1 hour	$0.1636416 / 1 hour	$0.19992 / 1 hour	$0.1364 / 1 hour
c4a-highcpu-16

16

32 GiB

$0.60608 / 1 hour	$0.4363776 / 1 hour	$0.3272832 / 1 hour	$0.39984 / 1 hour	$0.2728 / 1 hour
c4a-highcpu-32

32

64 GiB

$1.21216 / 1 hour	$0.8727552 / 1 hour	$0.6545664 / 1 hour	$0.79968 / 1 hour	$0.5456 / 1 hour
c4a-highcpu-48

48

96 GiB

$1.81824 / 1 hour	$1.3091328 / 1 hour	$0.9818496 / 1 hour	$1.19952 / 1 hour	$0.8184 / 1 hour
c4a-highcpu-64

64

128 GiB

$2.42432 / 1 hour	$1.7455104 / 1 hour	$1.3091328 / 1 hour	$1.59936 / 1 hour	$1.0912 / 1 hour
c4a-highcpu-72

72

144 GiB

$2.72736 / 1 hour	$1.9636992 / 1 hour	$1.4727744 / 1 hour	$1.79928 / 1 hour	$1.2276 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A Standard with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
VM Shape

vCPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4a-standard-4-lssd

4

16 GiB

375 GiB

$0.241243836 / 1 hour	$0.173695562 / 1 hour	$0.130271671 / 1 hour	$0.159124932 / 1 hour	$0.108579726 / 1 hour
c4a-standard-8-lssd

8

32 GiB

750 GiB

$0.482487671 / 1 hour	$0.347391123 / 1 hour	$0.260543342 / 1 hour	$0.318249863 / 1 hour	$0.217159452 / 1 hour
c4a-standard-16-lssd

16

64 GiB

1500 GiB

$0.964975342 / 1 hour	$0.694782247 / 1 hour	$0.521086685 / 1 hour	$0.636499726 / 1 hour	$0.434318904 / 1 hour
c4a-standard-32-lssd

32

128 GiB

2250 GiB

$1.806663014 / 1 hour	$1.30079737 / 1 hour	$0.975598027 / 1 hour	$1.191629589 / 1 hour	$0.813158356 / 1 hour
c4a-standard-48-lssd

48

192 GiB

3750 GiB

$2.771638356 / 1 hour	$1.995579616 / 1 hour	$1.496684712 / 1 hour	$1.828129315 / 1 hour	$1.24747726 / 1 hour
c4a-standard-64-lssd

64

256 GiB

5250 GiB

$3.736613699 / 1 hour	$2.690361863 / 1 hour	$2.017771397 / 1 hour	$2.464629041 / 1 hour	$1.681796164 / 1 hour
c4a-standard-72-lssd

72

288 GiB

6000 GiB

$4.21910137 / 1 hour	$3.037752986 / 1 hour	$2.27831474 / 1 hour	$2.782878904 / 1 hour	$1.898955616 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A Highmem with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
VM Shape

vCPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4a-highmem-4-lssd

4

32 GiB

375 GiB

$0.297403836 / 1 hour	$0.214130762 / 1 hour	$0.160598071 / 1 hour	$0.196084932 / 1 hour	$0.133859726 / 1 hour
c4a-highmem-8-lssd

8

64 GiB

750 GiB

$0.594807671 / 1 hour	$0.428261523 / 1 hour	$0.321196142 / 1 hour	$0.392169863 / 1 hour	$0.267719452 / 1 hour
c4a-highmem-16-lssd

16

128 GiB

1500 GiB

$1.189615342 / 1 hour	$0.856523047 / 1 hour	$0.642392285 / 1 hour	$0.784339726 / 1 hour	$0.535438904 / 1 hour
c4a-highmem-32-lssd

32

256 GiB

2250 GiB

$2.255943014 / 1 hour	$1.62427897 / 1 hour	$1.218209227 / 1 hour	$1.487309589 / 1 hour	$1.015398356 / 1 hour
c4a-highmem-48-lssd

48

384 GiB

3750 GiB

$3.445558356 / 1 hour	$2.480802016 / 1 hour	$1.860601512 / 1 hour	$2.271649315 / 1 hour	$1.55083726 / 1 hour
c4a-highmem-64-lssd

64

512 GiB

5250 GiB

$4.635173699 / 1 hour	$3.337325063 / 1 hour	$2.502993797 / 1 hour	$3.055989041 / 1 hour	$2.086276164 / 1 hour
c4a-highmem-72-lssd

72

576 GiB

6000 GiB

$5.22998137 / 1 hour	$3.765586586 / 1 hour	$2.82418994 / 1 hour	$3.448158904 / 1 hour	$2.353995616 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4D machine types

C4D standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4d-standard-2

2

7 GiB

$0.089876046 / 1 hour	$0.064710752 / 1 hour	$0.048533064 / 1 hour	$0.056622024 / 1 hour	$0.040444172 / 1 hour
c4d-standard-4

4

15 GiB

$0.18324767 / 1 hour	$0.13193832 / 1 hour	$0.09895374 / 1 hour	$0.11544628 / 1 hour	$0.08246134 / 1 hour
c4d-standard-8

8

31 GiB

$0.369990918 / 1 hour	$0.266393456 / 1 hour	$0.199795092 / 1 hour	$0.233094792 / 1 hour	$0.166495676 / 1 hour
c4d-standard-16

16

62 GiB

$0.739981836 / 1 hour	$0.532786912 / 1 hour	$0.399590184 / 1 hour	$0.466189584 / 1 hour	$0.332991352 / 1 hour
c4d-standard-32

32

124 GiB

$1.479963672 / 1 hour	$1.065573824 / 1 hour	$0.799180368 / 1 hour	$0.932379168 / 1 hour	$0.665982704 / 1 hour
c4d-standard-48

48

186 GiB

$2.219945508 / 1 hour	$1.598360736 / 1 hour	$1.198770552 / 1 hour	$1.398568752 / 1 hour	$0.998974056 / 1 hour
c4d-standard-64

64

248 GiB

$2.959927344 / 1 hour	$2.131147648 / 1 hour	$1.598360736 / 1 hour	$1.864758336 / 1 hour	$1.331965408 / 1 hour
c4d-standard-96

96

372 GiB

$4.439891016 / 1 hour	$3.196721472 / 1 hour	$2.397541104 / 1 hour	$2.797137504 / 1 hour	$1.997948112 / 1 hour
c4d-standard-192

192

744 GiB

$8.879782032 / 1 hour	$6.393442944 / 1 hour	$4.795082208 / 1 hour	$5.594275008 / 1 hour	$3.995896224 / 1 hour
c4d-standard-384

384

1488 GiB

$17.759564064 / 1 hour	$12.786885888 / 1 hour	$9.590164416 / 1 hour	$11.188550016 / 1 hour	$7.991792448 / 1 hour
c4d-standard-384-metal

384

1536 GiB

$17.927351808 / 1 hour	$12.907693056 / 1 hour	$9.680769792 / 1 hour	$11.294257152 / 1 hour	$8.067296256 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4D high-memory machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4d-highmem-2

2

15 GiB

$0.11784067 / 1 hour	$0.08484528 / 1 hour	$0.06363396 / 1 hour	$0.07423988 / 1 hour	$0.05302814 / 1 hour
c4d-highmem-4

4

31 GiB

$0.239176918 / 1 hour	$0.172207376 / 1 hour	$0.129155532 / 1 hour	$0.150681992 / 1 hour	$0.107629276 / 1 hour
c4d-highmem-8

8

63 GiB

$0.481849414 / 1 hour	$0.346931568 / 1 hour	$0.260198676 / 1 hour	$0.303566216 / 1 hour	$0.216831548 / 1 hour
c4d-highmem-16

16

126 GiB

$0.963698828 / 1 hour	$0.693863136 / 1 hour	$0.520397352 / 1 hour	$0.607132432 / 1 hour	$0.433663096 / 1 hour
c4d-highmem-32

32

252 GiB

$1.927397656 / 1 hour	$1.387726272 / 1 hour	$1.040794704 / 1 hour	$1.214264864 / 1 hour	$0.867326192 / 1 hour
c4d-highmem-48

48

378 GiB

$2.891096484 / 1 hour	$2.081589408 / 1 hour	$1.561192056 / 1 hour	$1.821397296 / 1 hour	$1.300989288 / 1 hour
c4d-highmem-64

64

504 GiB

$3.854795312 / 1 hour	$2.775452544 / 1 hour	$2.081589408 / 1 hour	$2.428529728 / 1 hour	$1.734652384 / 1 hour
c4d-highmem-96

96

756 GiB

$5.782192968 / 1 hour	$4.163178816 / 1 hour	$3.122384112 / 1 hour	$3.642794592 / 1 hour	$2.601978576 / 1 hour
c4d-highmem-192

192

1512 GiB

$11.564385936 / 1 hour	$8.326357632 / 1 hour	$6.244768224 / 1 hour	$7.285589184 / 1 hour	$5.203957152 / 1 hour
c4d-highmem-384

384

3024 GiB

$23.128771872 / 1 hour	$16.652715264 / 1 hour	$12.489536448 / 1 hour	$14.571178368 / 1 hour	$10.407914304 / 1 hour
c4d-highmem-384-metal

384

3072 GiB

$23.296559616 / 1 hour	$16.773522432 / 1 hour	$12.580141824 / 1 hour	$14.676885504 / 1 hour	$10.483418112 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4D high-CPU machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4d-highcpu-2

2

3 GiB

$0.075893734 / 1 hour	$0.054643488 / 1 hour	$0.040982616 / 1 hour	$0.047813096 / 1 hour	$0.034152188 / 1 hour
c4d-highcpu-4

4

7 GiB

$0.155283046 / 1 hour	$0.111803792 / 1 hour	$0.083852844 / 1 hour	$0.097828424 / 1 hour	$0.069877372 / 1 hour
c4d-highcpu-8

8

15 GiB

$0.31406167 / 1 hour	$0.2261244 / 1 hour	$0.1695933 / 1 hour	$0.19785908 / 1 hour	$0.14132774 / 1 hour
c4d-highcpu-16

16

30 GiB

$0.62812334 / 1 hour	$0.4522488 / 1 hour	$0.3391866 / 1 hour	$0.39571816 / 1 hour	$0.28265548 / 1 hour
c4d-highcpu-32

32

60 GiB

$1.25624668 / 1 hour	$0.9044976 / 1 hour	$0.6783732 / 1 hour	$0.79143632 / 1 hour	$0.56531096 / 1 hour
c4d-highcpu-48

48

90 GiB

$1.88437002 / 1 hour	$1.3567464 / 1 hour	$1.0175598 / 1 hour	$1.18715448 / 1 hour	$0.84796644 / 1 hour
c4d-highcpu-64

64

120 GiB

$2.51249336 / 1 hour	$1.8089952 / 1 hour	$1.3567464 / 1 hour	$1.58287264 / 1 hour	$1.13062192 / 1 hour
c4d-highcpu-96

96

180 GiB

$3.76874004 / 1 hour	$2.7134928 / 1 hour	$2.0351196 / 1 hour	$2.37430896 / 1 hour	$1.69593288 / 1 hour
c4d-highcpu-192

192

360 GiB

$7.53748008 / 1 hour	$5.4269856 / 1 hour	$4.0702392 / 1 hour	$4.74861792 / 1 hour	$3.39186576 / 1 hour
c4d-highcpu-384

384

720 GiB

$15.07496016 / 1 hour	$10.8539712 / 1 hour	$8.1404784 / 1 hour	$9.49723584 / 1 hour	$6.78373152 / 1 hour
c4d-highcpu-384-metal

384

768 GiB

$15.242747904 / 1 hour	$10.974778368 / 1 hour	$8.231083776 / 1 hour	$9.602942976 / 1 hour	$6.859235328 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4D Standard with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4d-standard-8-lssd

8

31 GiB

375 GiB

$0.452182699 / 1 hour	$0.325571538 / 1 hour	$0.244178654 / 1 hour	$0.284875614 / 1 hour	$0.203481977 / 1 hour
c4d-standard-16-lssd

16

62 GiB

375 GiB

$0.822173617 / 1 hour	$0.591964994 / 1 hour	$0.443973746 / 1 hour	$0.517970406 / 1 hour	$0.369977653 / 1 hour
c4d-standard-32-lssd

32

124 GiB

750 GiB

$1.644347234 / 1 hour	$1.183929988 / 1 hour	$0.887947491 / 1 hour	$1.035940812 / 1 hour	$0.739955307 / 1 hour
c4d-standard-48-lssd

48

186 GiB

1500 GiB

$2.548712631 / 1 hour	$1.835073065 / 1 hour	$1.376304799 / 1 hour	$1.60569204 / 1 hour	$1.146919261 / 1 hour
c4d-standard-64-lssd

64

248 GiB

2250 GiB

$3.453078029 / 1 hour	$2.486216141 / 1 hour	$1.864662106 / 1 hour	$2.175443268 / 1 hour	$1.553883216 / 1 hour
c4d-standard-96-lssd

96

372 GiB

3000 GiB

$5.097425263 / 1 hour	$3.67014613 / 1 hour	$2.752609597 / 1 hour	$3.211384079 / 1 hour	$2.293838523 / 1 hour
c4d-standard-192-lssd

192

744 GiB

6000 GiB

$10.194850525 / 1 hour	$7.340292259 / 1 hour	$5.505219194 / 1 hour	$6.422768159 / 1 hour	$4.587677046 / 1 hour
c4d-standard-384-lssd

384

1488 GiB

12000 GiB

$20.38970105 / 1 hour	$14.680584518 / 1 hour	$11.010438389 / 1 hour	$12.845536317 / 1 hour	$9.175354092 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4D Highmem with Local SSD

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c4d-highmem-8-lssd

8

63 GiB

375 GiB

$0.564041195 / 1 hour	$0.40610965 / 1 hour	$0.304582238 / 1 hour	$0.355347038 / 1 hour	$0.253817849 / 1 hour
c4d-highmem-16-lssd

16

126 GiB

375 GiB

$1.045890609 / 1 hour	$0.753041218 / 1 hour	$0.564780914 / 1 hour	$0.658913254 / 1 hour	$0.470649397 / 1 hour
c4d-highmem-32-lssd

32

252 GiB

750 GiB

$2.091781218 / 1 hour	$1.506082436 / 1 hour	$1.129561827 / 1 hour	$1.317826508 / 1 hour	$0.941298795 / 1 hour
c4d-highmem-48-lssd

48

378 GiB

1500 GiB

$3.219863607 / 1 hour	$2.318301737 / 1 hour	$1.738726303 / 1 hour	$2.028520584 / 1 hour	$1.448934493 / 1 hour
c4d-highmem-64-lssd

64

504 GiB

2250 GiB

$4.347945997 / 1 hour	$3.130521037 / 1 hour	$2.347890778 / 1 hour	$2.73921466 / 1 hour	$1.956570192 / 1 hour
c4d-highmem-96-lssd

96

756 GiB

3000 GiB

$6.439727215 / 1 hour	$4.636603474 / 1 hour	$3.477452605 / 1 hour	$4.057041167 / 1 hour	$2.897868987 / 1 hour
c4d-highmem-192-lssd

192

1512 GiB

6000 GiB

$12.879454429 / 1 hour	$9.273206947 / 1 hour	$6.95490521 / 1 hour	$8.114082335 / 1 hour	$5.795737974 / 1 hour
c4d-highmem-384-lssd

384

3024 GiB

12000 GiB

$25.758908858 / 1 hour	$18.546413894 / 1 hour	$13.909810421 / 1 hour	$16.228164669 / 1 hour	$11.591475948 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4 machine types

N4 standard machine types

The following table shows the calculated costs for standard predefined machine types in the N4 machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 4 GiB of memory per vCPU.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4-standard-2

2

8 GiB

$0.0907 / 1 hour	$0.065304 / 1 hour	$0.048978 / 1 hour	$0.05714 / 1 hour	$0.040816 / 1 hour
n4-standard-4

4

16 GiB

$0.1814 / 1 hour	$0.130608 / 1 hour	$0.097956 / 1 hour	$0.11428 / 1 hour	$0.081632 / 1 hour
n4-standard-8

8

32 GiB

$0.3628 / 1 hour	$0.261216 / 1 hour	$0.195912 / 1 hour	$0.22856 / 1 hour	$0.163264 / 1 hour
n4-standard-16

16

64 GiB

$0.7256 / 1 hour	$0.522432 / 1 hour	$0.391824 / 1 hour	$0.45712 / 1 hour	$0.326528 / 1 hour
n4-standard-32

32

128 GiB

$1.4512 / 1 hour	$1.044864 / 1 hour	$0.783648 / 1 hour	$0.91424 / 1 hour	$0.653056 / 1 hour
n4-standard-48

48

192 GiB

$2.1768 / 1 hour	$1.567296 / 1 hour	$1.175472 / 1 hour	$1.37136 / 1 hour	$0.979584 / 1 hour
n4-standard-64

64

256 GiB

$2.9024 / 1 hour	$2.089728 / 1 hour	$1.567296 / 1 hour	$1.82848 / 1 hour	$1.306112 / 1 hour
n4-standard-80

80

320 GiB

$3.628 / 1 hour	$2.61216 / 1 hour	$1.95912 / 1 hour	$2.2856 / 1 hour	$1.63264 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4 high-memory machine types

The following table shows the calculated cost for the N4 high-memory predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-memory machine types have 8 GiB of memory per vCPU. High-memory instances are ideal for tasks that require more memory relative to virtual CPUs.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4-highmem-2

2

16 GiB

$0.11902 / 1 hour	$0.0856944 / 1 hour	$0.0642708 / 1 hour	$0.07498 / 1 hour	$0.05356 / 1 hour
n4-highmem-4

4

32 GiB

$0.23804 / 1 hour	$0.1713888 / 1 hour	$0.1285416 / 1 hour	$0.14996 / 1 hour	$0.10712 / 1 hour
n4-highmem-8

8

64 GiB

$0.47608 / 1 hour	$0.3427776 / 1 hour	$0.2570832 / 1 hour	$0.29992 / 1 hour	$0.21424 / 1 hour
n4-highmem-16

16

128 GiB

$0.95216 / 1 hour	$0.6855552 / 1 hour	$0.5141664 / 1 hour	$0.59984 / 1 hour	$0.42848 / 1 hour
n4-highmem-32

32

256 GiB

$1.90432 / 1 hour	$1.3711104 / 1 hour	$1.0283328 / 1 hour	$1.19968 / 1 hour	$0.85696 / 1 hour
n4-highmem-48

48

384 GiB

$2.85648 / 1 hour	$2.0566656 / 1 hour	$1.5424992 / 1 hour	$1.79952 / 1 hour	$1.28544 / 1 hour
n4-highmem-64

64

512 GiB

$3.80864 / 1 hour	$2.7422208 / 1 hour	$2.0566656 / 1 hour	$2.39936 / 1 hour	$1.71392 / 1 hour
n4-highmem-80

80

640 GiB

$4.7608 / 1 hour	$3.427776 / 1 hour	$2.570832 / 1 hour	$2.9992 / 1 hour	$2.1424 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4 high-CPU machine types

The following table shows the calculated cost for N4 high-CPU predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-CPU machine types have one vCPU for every 1 GiB of memory. High-CPU machine types are ideal for tasks that require moderate memory configurations for the needed vCPU count.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4-highcpu-2

2

4 GiB

$0.07654 / 1 hour	$0.0551088 / 1 hour	$0.0413316 / 1 hour	$0.04822 / 1 hour	$0.034444 / 1 hour
n4-highcpu-4

4

8 GiB

$0.15308 / 1 hour	$0.1102176 / 1 hour	$0.0826632 / 1 hour	$0.09644 / 1 hour	$0.068888 / 1 hour
n4-highcpu-8

8

16 GiB

$0.30616 / 1 hour	$0.2204352 / 1 hour	$0.1653264 / 1 hour	$0.19288 / 1 hour	$0.137776 / 1 hour
n4-highcpu-16

16

32 GiB

$0.61232 / 1 hour	$0.4408704 / 1 hour	$0.3306528 / 1 hour	$0.38576 / 1 hour	$0.275552 / 1 hour
n4-highcpu-32

32

64 GiB

$1.22464 / 1 hour	$0.8817408 / 1 hour	$0.6613056 / 1 hour	$0.77152 / 1 hour	$0.551104 / 1 hour
n4-highcpu-48

48

96 GiB

$1.82634 / 1 hour	$1.3149648 / 1 hour	$0.9862236 / 1 hour	$1.15059 / 1 hour	$0.821877 / 1 hour
n4-highcpu-64

64

128 GiB

$2.44928 / 1 hour	$1.7634816 / 1 hour	$1.3226112 / 1 hour	$1.54304 / 1 hour	$1.102208 / 1 hour
n4-highcpu-80

80

160 GiB

$3.0616 / 1 hour	$2.204352 / 1 hour	$1.653264 / 1 hour	$1.9288 / 1 hour	$1.37776 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4 custom vCPUs and memory

Custom machine types let you set a specific number of vCPUs and GiB of memory for your instances to match the needs of your workload. Custom machine types save you the cost of running on a larger and more expensive machine type if your application does not require all of the resources provided by that machine type.

Read Creating a VM instance with a custom machine type to learn how to use these machine types.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.03275 / 1 hour	$0.02358 / 1 hour	$0.017685 / 1 hour	$0.000702 / 1 hour
Custom Memory

$0.003717 / 1 gibibyte hour	$0.00267624 / 1 gibibyte hour	$0.00200718 / 1 gibibyte hour	$0.00008 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

The CUDs prices for Custom Machine Types reflect a 5% premium over predefined shapes. The premium applies only for the duration and amount of CMTs used and covered by the CUDs. More details please refer to the documentation for Resource-based committed use discounts.

N4 extended custom memory

For custom machine types, any memory up to and including 8 GiB of memory per vCPU is charged at the standard custom vCPU and memory pricing rate. Any memory above 8 GiB per vCPU is charged according to the following extended memory prices. To learn how to create instances with custom machine types and extended memory, see Adding extended memory to a machine type.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
1 year resource-based commitment price (USD)

3 year resource-based commitment price (USD)

Extended custom memory

$0.008745975 / 1 gibibyte hour	$0.006297102 / 1 gibibyte hour	$0.004722827 / 1 gibibyte hour	
Unavailable

Unavailable

* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4D machine types

N4D standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4d-standard-2

2

8 GiB

$0.0847 / 1 hour	$0.060984 / 1 hour	$0.045738 / 1 hour	$0.053358 / 1 hour	$0.03812 / 1 hour
n4d-standard-4

4

16 GiB

$0.1694 / 1 hour	$0.121968 / 1 hour	$0.091476 / 1 hour	$0.106716 / 1 hour	$0.07624 / 1 hour
n4d-standard-8

8

32 GiB

$0.3388 / 1 hour	$0.243936 / 1 hour	$0.182952 / 1 hour	$0.213432 / 1 hour	$0.15248 / 1 hour
n4d-standard-16

16

64 GiB

$0.6776 / 1 hour	$0.487872 / 1 hour	$0.365904 / 1 hour	$0.426864 / 1 hour	$0.30496 / 1 hour
n4d-standard-32

32

128 GiB

$1.3552 / 1 hour	$0.975744 / 1 hour	$0.731808 / 1 hour	$0.853728 / 1 hour	$0.60992 / 1 hour
n4d-standard-48

48

192 GiB

$2.0328 / 1 hour	$1.463616 / 1 hour	$1.097712 / 1 hour	$1.280592 / 1 hour	$0.91488 / 1 hour
n4d-standard-64

64

256 GiB

$2.7104 / 1 hour	$1.951488 / 1 hour	$1.463616 / 1 hour	$1.707456 / 1 hour	$1.21984 / 1 hour
n4d-standard-80

80

320 GiB

$3.388 / 1 hour	$2.43936 / 1 hour	$1.82952 / 1 hour	$2.13432 / 1 hour	$1.5248 / 1 hour
n4d-standard-96

96

384 GiB

$4.0656 / 1 hour	$2.927232 / 1 hour	$2.195424 / 1 hour	$2.561184 / 1 hour	$1.82976 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4D high-memory machine types﻿

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4d-highmem-2

2

16 GiB

$0.11118 / 1 hour	$0.0800496 / 1 hour	$0.0600372 / 1 hour	$0.070038 / 1 hour	$0.05004 / 1 hour
n4d-highmem-4

4

32 GiB

$0.22236 / 1 hour	$0.1600992 / 1 hour	$0.1200744 / 1 hour	$0.140076 / 1 hour	$0.10008 / 1 hour
n4d-highmem-8

8

64 GiB

$0.44472 / 1 hour	$0.3201984 / 1 hour	$0.2401488 / 1 hour	$0.280152 / 1 hour	$0.20016 / 1 hour
n4d-highmem-16

16

128 GiB

$0.88944 / 1 hour	$0.6403968 / 1 hour	$0.4802976 / 1 hour	$0.560304 / 1 hour	$0.40032 / 1 hour
n4d-highmem-32

32

256 GiB

$1.77888 / 1 hour	$1.2807936 / 1 hour	$0.9605952 / 1 hour	$1.120608 / 1 hour	$0.80064 / 1 hour
n4d-highmem-48

48

384 GiB

$2.66832 / 1 hour	$1.9211904 / 1 hour	$1.4408928 / 1 hour	$1.680912 / 1 hour	$1.20096 / 1 hour
n4d-highmem-64

64

512 GiB

$3.55776 / 1 hour	$2.5615872 / 1 hour	$1.9211904 / 1 hour	$2.241216 / 1 hour	$1.60128 / 1 hour
n4d-highmem-80

80

640 GiB

$4.4472 / 1 hour	$3.201984 / 1 hour	$2.401488 / 1 hour	$2.80152 / 1 hour	$2.0016 / 1 hour
n4d-highmem-96

96

768 GiB

$5.33664 / 1 hour	$3.8423808 / 1 hour	$2.8817856 / 1 hour	$3.361824 / 1 hour	$2.40192 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4D high-cpu machine types﻿

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4d-highcpu-2

2

4 GiB

$0.07146 / 1 hour	$0.0514512 / 1 hour	$0.0385884 / 1 hour	$0.045018 / 1 hour	$0.03216 / 1 hour
n4d-highcpu-4

4

8 GiB

$0.14292 / 1 hour	$0.1029024 / 1 hour	$0.0771768 / 1 hour	$0.090036 / 1 hour	$0.06432 / 1 hour
n4d-highcpu-8

8

16 GiB

$0.28584 / 1 hour	$0.2058048 / 1 hour	$0.1543536 / 1 hour	$0.180072 / 1 hour	$0.12864 / 1 hour
n4d-highcpu-16

16

32 GiB

$0.57168 / 1 hour	$0.4116096 / 1 hour	$0.3087072 / 1 hour	$0.360144 / 1 hour	$0.25728 / 1 hour
n4d-highcpu-32

32

64 GiB

$1.14336 / 1 hour	$0.8232192 / 1 hour	$0.6174144 / 1 hour	$0.720288 / 1 hour	$0.51456 / 1 hour
n4d-highcpu-48

48

96 GiB

$1.71504 / 1 hour	$1.2348288 / 1 hour	$0.9261216 / 1 hour	$1.080432 / 1 hour	$0.77184 / 1 hour
n4d-highcpu-64

64

128 GiB

$2.28672 / 1 hour	$1.6464384 / 1 hour	$1.2348288 / 1 hour	$1.440576 / 1 hour	$1.02912 / 1 hour
n4d-highcpu-80

80

160 GiB

$2.8584 / 1 hour	$2.058048 / 1 hour	$1.543536 / 1 hour	$1.80072 / 1 hour	$1.2864 / 1 hour
n4d-highcpu-96

96

192 GiB

$3.43008 / 1 hour	$2.4696576 / 1 hour	$1.8522432 / 1 hour	$2.160864 / 1 hour	$1.54368 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4D custom vCPUs and memory

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.030566 / 1 hour	$0.02200752 / 1 hour	$0.01650564 / 1 hour	$0.000655 / 1 hour
Custom Memory

$0.003476 / 1 gibibyte hour	$0.00250272 / 1 gibibyte hour	$0.00187704 / 1 gibibyte hour	$0.00007448 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4A machine types

N4A standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n4a-standard-1

1

4 GiB

$0.0385 / 1 hour	$0.02772 / 1 hour	$0.02079 / 1 hour	$0.025412 / 1 hour	$0.017327 / 1 hour
n4a-standard-2

2

8 GiB

$0.077 / 1 hour	$0.05544 / 1 hour	$0.04158 / 1 hour	$0.050824 / 1 hour	$0.034654 / 1 hour
n4a-standard-4

4

16 GiB

$0.154 / 1 hour	$0.11088 / 1 hour	$0.08316 / 1 hour	$0.101648 / 1 hour	$0.069308 / 1 hour
n4a-standard-8

8

32 GiB

$0.308 / 1 hour	$0.22176 / 1 hour	$0.16632 / 1 hour	$0.203296 / 1 hour	$0.138616 / 1 hour
n4a-standard-16

16

64 GiB

$0.616 / 1 hour	$0.44352 / 1 hour	$0.33264 / 1 hour	$0.406592 / 1 hour	$0.277232 / 1 hour
n4a-standard-32

32

128 GiB

$1.232 / 1 hour	$0.88704 / 1 hour	$0.66528 / 1 hour	$0.813184 / 1 hour	$0.554464 / 1 hour
n4a-standard-48

48

192 GiB

$1.848 / 1 hour	$1.33056 / 1 hour	$0.99792 / 1 hour	$1.219776 / 1 hour	$0.831696 / 1 hour
n4a-standard-64

64

256 GiB

$2.464 / 1 hour	$1.77408 / 1 hour	$1.33056 / 1 hour	$1.626368 / 1 hour	$1.108928 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4A high-memory machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)



n4a-highmem-1

1

8 GiB

$0.05054 / 1 hour	$0.0363888 / 1 hour	$0.0272916 / 1 hour	$0.03336 / 1 hour	$0.022747 / 1 hour
n4a-highmem-2

2

16 GiB

$0.10108 / 1 hour	$0.0727776 / 1 hour	$0.0545832 / 1 hour	$0.06672 / 1 hour	$0.045494 / 1 hour
n4a-highmem-4

4

32 GiB

$0.20216 / 1 hour	$0.1455552 / 1 hour	$0.1091664 / 1 hour	$0.13344 / 1 hour	$0.090988 / 1 hour
n4a-highmem-8

8

64 GiB

$0.40432 / 1 hour	$0.2911104 / 1 hour	$0.2183328 / 1 hour	$0.26688 / 1 hour	$0.181976 / 1 hour
n4a-highmem-16

16

128 GiB

$0.80864 / 1 hour	$0.5822208 / 1 hour	$0.4366656 / 1 hour	$0.53376 / 1 hour	$0.363952 / 1 hour
n4a-highmem-32

32

256 GiB

$1.61728 / 1 hour	$1.1644416 / 1 hour	$0.8733312 / 1 hour	$1.06752 / 1 hour	$0.727904 / 1 hour
n4a-highmem-48

48

384 GiB

$2.42592 / 1 hour	$1.7466624 / 1 hour	$1.3099968 / 1 hour	$1.60128 / 1 hour	$1.091856 / 1 hour
n4a-highmem-64

64

512 GiB

$3.23456 / 1 hour	$2.3288832 / 1 hour	$1.7466624 / 1 hour	$2.13504 / 1 hour	$1.455808 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4A high-cpu machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)



n4a-highcpu-1

1

2 GiB

$0.03248 / 1 hour	$0.0233856 / 1 hour	$0.0175392 / 1 hour	$0.021438 / 1 hour	$0.014617 / 1 hour
n4a-highcpu-2

2

4 GiB

$0.06496 / 1 hour	$0.0467712 / 1 hour	$0.0350784 / 1 hour	$0.042876 / 1 hour	$0.029234 / 1 hour
n4a-highcpu-4

4

8 GiB

$0.12992 / 1 hour	$0.0935424 / 1 hour	$0.0701568 / 1 hour	$0.085752 / 1 hour	$0.058468 / 1 hour
n4a-highcpu-8

8

16 GiB

$0.25984 / 1 hour	$0.1870848 / 1 hour	$0.1403136 / 1 hour	$0.171504 / 1 hour	$0.116936 / 1 hour
n4a-highcpu-16

16

32 GiB

$0.51968 / 1 hour	$0.3741696 / 1 hour	$0.2806272 / 1 hour	$0.343008 / 1 hour	$0.233872 / 1 hour
n4a-highcpu-32

32

64 GiB

$1.03936 / 1 hour	$0.7483392 / 1 hour	$0.5612544 / 1 hour	$0.686016 / 1 hour	$0.467744 / 1 hour
n4a-highcpu-48

48

96 GiB

$1.55904 / 1 hour	$1.1225088 / 1 hour	$0.8418816 / 1 hour	$1.029024 / 1 hour	$0.701616 / 1 hour
n4a-highcpu-64

64

128 GiB

$2.07872 / 1 hour	$1.4966784 / 1 hour	$1.1225088 / 1 hour	$1.372032 / 1 hour	$0.935488 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4A custom vCPUs and memory

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.027783 / 1 hour	$0.02000376 / 1 hour	$0.01500282 / 1 hour	$0.000595 / 1 hour
Custom Memory

$0.003161 / 1 gibibyte hour	$0.00227592 / 1 gibibyte hour	$0.00170694 / 1 gibibyte hour	$0.000068 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N4 extended custom memory

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

Extended custom memory

$0.00677 / 1 gibibyte hour	$0.0048744 / 1 gibibyte hour	$0.0036558 / 1 gibibyte hour	$0.001987 / 1 gibibyte hour	$0.001355 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3 machine types

C3 standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3-standard-4

4

16 GiB

$0.201608 / 1 hour	$0.14515776 / 1 hour	$0.10886832 / 1 hour	$0.127016 / 1 hour	$0.090724 / 1 hour
c3-standard-8

8

32 GiB

$0.403216 / 1 hour	$0.29031552 / 1 hour	$0.21773664 / 1 hour	$0.254032 / 1 hour	$0.181448 / 1 hour
c3-standard-22

22

88 GiB

$1.108844 / 1 hour	$0.79836768 / 1 hour	$0.59877576 / 1 hour	$0.698588 / 1 hour	$0.498982 / 1 hour
c3-standard-44

44

176 GiB

$2.217688 / 1 hour	$1.59673536 / 1 hour	$1.19755152 / 1 hour	$1.397176 / 1 hour	$0.997964 / 1 hour
c3-standard-88

88

352 GiB

$4.435376 / 1 hour	$3.19347072 / 1 hour	$2.39510304 / 1 hour	$2.794352 / 1 hour	$1.995928 / 1 hour
c3-standard-176

176

704 GiB

$8.870752 / 1 hour	$6.38694144 / 1 hour	$4.79020608 / 1 hour	$5.588704 / 1 hour	$3.991856 / 1 hour
c3-standard-192-metal

192

768 GiB

$9.677184 / 1 hour	$6.96757248 / 1 hour	$5.22567936 / 1 hour	$6.096768 / 1 hour	$4.354752 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.



C3 high-memory machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3-highmem-4

4

32 GiB

$0.264616 / 1 hour	$0.19052352 / 1 hour	$0.14289264 / 1 hour	$0.166712 / 1 hour	$0.119076 / 1 hour
c3-highmem-8

8

64 GiB

$0.529232 / 1 hour	$0.38104704 / 1 hour	$0.28578528 / 1 hour	$0.333424 / 1 hour	$0.238152 / 1 hour
c3-highmem-22

22

176 GiB

$1.455388 / 1 hour	$1.04787936 / 1 hour	$0.78590952 / 1 hour	$0.916916 / 1 hour	$0.654918 / 1 hour
c3-highmem-44

44

352 GiB

$2.910776 / 1 hour	$2.09575872 / 1 hour	$1.57181904 / 1 hour	$1.833832 / 1 hour	$1.309836 / 1 hour
c3-highmem-88

88

704 GiB

$5.821552 / 1 hour	$4.19151744 / 1 hour	$3.14363808 / 1 hour	$3.667664 / 1 hour	$2.619672 / 1 hour
c3-highmem-176

176

1408 GiB

$11.643104 / 1 hour	$8.38303488 / 1 hour	$6.28727616 / 1 hour	$7.335328 / 1 hour	$5.239344 / 1 hour
c3-highmem-192-metal

192

1536 GiB

$12.701568 / 1 hour	$9.14512896 / 1 hour	$6.85884672 / 1 hour	$8.002176 / 1 hour	$5.715648 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3 high-CPU machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3-highcpu-4

4

8 GiB

$0.170104 / 1 hour	$0.12247488 / 1 hour	$0.09185616 / 1 hour	$0.107168 / 1 hour	$0.076548 / 1 hour
c3-highcpu-8

8

16 GiB

$0.340208 / 1 hour	$0.24494976 / 1 hour	$0.18371232 / 1 hour	$0.214336 / 1 hour	$0.153096 / 1 hour
c3-highcpu-22

22

44 GiB

$0.935572 / 1 hour	$0.67361184 / 1 hour	$0.50520888 / 1 hour	$0.589424 / 1 hour	$0.421014 / 1 hour
c3-highcpu-44

44

88 GiB

$1.871144 / 1 hour	$1.34722368 / 1 hour	$1.01041776 / 1 hour	$1.178848 / 1 hour	$0.842028 / 1 hour
c3-highcpu-88

88

176 GiB

$3.742288 / 1 hour	$2.69444736 / 1 hour	$2.02083552 / 1 hour	$2.357696 / 1 hour	$1.684056 / 1 hour
c3-highcpu-176

176

352 GiB

$7.484576 / 1 hour	$5.38889472 / 1 hour	$4.04167104 / 1 hour	$4.715392 / 1 hour	$3.368112 / 1 hour
c3-highcpu-192-metal

192

512 GiB

$8.669056 / 1 hour	$6.24172032 / 1 hour	$4.68129024 / 1 hour	$5.461632 / 1 hour	$3.90112 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.



C3D machine types﻿

C3D standard machine types
Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3d-standard-4

4

16 GiB

$0.181596 / 1 hour	$0.13074912 / 1 hour	$0.09806184 / 1 hour	$0.1144 / 1 hour	$0.081708 / 1 hour
c3d-standard-8

8

32 GiB

$0.363192 / 1 hour	$0.26149824 / 1 hour	$0.19612368 / 1 hour	$0.2288 / 1 hour	$0.163416 / 1 hour
c3d-standard-16

16

64 GiB

$0.726384 / 1 hour	$0.52299648 / 1 hour	$0.39224736 / 1 hour	$0.4576 / 1 hour	$0.326832 / 1 hour
c3d-standard-30

30

120 GiB

$1.36197 / 1 hour	$0.9806184 / 1 hour	$0.7354638 / 1 hour	$0.858 / 1 hour	$0.61281 / 1 hour
c3d-standard-60

60

240 GiB

$2.72394 / 1 hour	$1.9612368 / 1 hour	$1.4709276 / 1 hour	$1.716 / 1 hour	$1.22562 / 1 hour
c3d-standard-90

90

360 GiB

$4.08591 / 1 hour	$2.9418552 / 1 hour	$2.2063914 / 1 hour	$2.574 / 1 hour	$1.83843 / 1 hour
c3d-standard-180

180

720 GiB

$8.17182 / 1 hour	$5.8837104 / 1 hour	$4.4127828 / 1 hour	$5.148 / 1 hour	$3.67686 / 1 hour
c3d-standard-360

360

1440 GiB

$16.34364 / 1 hour	$11.7674208 / 1 hour	$8.8255656 / 1 hour	$10.296 / 1 hour	$7.35372 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3D high-memory machine types
Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3d-highmem-4

4

32 GiB

$0.24494 / 1 hour	$0.1763568 / 1 hour	$0.1322676 / 1 hour	$0.154304 / 1 hour	$0.110204 / 1 hour
c3d-highmem-8

8

64 GiB

$0.48988 / 1 hour	$0.3527136 / 1 hour	$0.2645352 / 1 hour	$0.308608 / 1 hour	$0.220408 / 1 hour
c3d-highmem-16

16

128 GiB

$0.97976 / 1 hour	$0.7054272 / 1 hour	$0.5290704 / 1 hour	$0.617216 / 1 hour	$0.440816 / 1 hour
c3d-highmem-30

30

240 GiB

$1.83705 / 1 hour	$1.322676 / 1 hour	$0.992007 / 1 hour	$1.15728 / 1 hour	$0.82653 / 1 hour
c3d-highmem-60

60

480 GiB

$3.6741 / 1 hour	$2.645352 / 1 hour	$1.984014 / 1 hour	$2.31456 / 1 hour	$1.65306 / 1 hour
c3d-highmem-90

90

720 GiB

$5.51115 / 1 hour	$3.968028 / 1 hour	$2.976021 / 1 hour	$3.47184 / 1 hour	$2.47959 / 1 hour
c3d-highmem-180

180

1440 GiB

$11.0223 / 1 hour	$7.936056 / 1 hour	$5.952042 / 1 hour	$6.94368 / 1 hour	$4.95918 / 1 hour
c3d-highmem-360

360

2880 GiB

$22.0446 / 1 hour	$15.872112 / 1 hour	$11.904084 / 1 hour	$13.88736 / 1 hour	$9.91836 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3D high-CPU machine types
Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c3d-highcpu-4

4

8 GiB

$0.149924 / 1 hour	$0.10794528 / 1 hour	$0.08095896 / 1 hour	$0.094448 / 1 hour	$0.06746 / 1 hour
c3d-highcpu-8

8

16 GiB

$0.299848 / 1 hour	$0.21589056 / 1 hour	$0.16191792 / 1 hour	$0.188896 / 1 hour	$0.13492 / 1 hour
c3d-highcpu-16

16

32 GiB

$0.599696 / 1 hour	$0.43178112 / 1 hour	$0.32383584 / 1 hour	$0.377792 / 1 hour	$0.26984 / 1 hour
c3d-highcpu-30

30

60 GiB

$1.12443 / 1 hour	$0.8095896 / 1 hour	$0.6071922 / 1 hour	$0.70836 / 1 hour	$0.50595 / 1 hour
c3d-highcpu-60

60

120 GiB

$2.24886 / 1 hour	$1.6191792 / 1 hour	$1.2143844 / 1 hour	$1.41672 / 1 hour	$1.0119 / 1 hour
c3d-highcpu-90

90

180 GiB

$3.37329 / 1 hour	$2.4287688 / 1 hour	$1.8215766 / 1 hour	$2.12508 / 1 hour	$1.51785 / 1 hour
c3d-highcpu-180

180

360 GiB

$6.74658 / 1 hour	$4.8575376 / 1 hour	$3.6431532 / 1 hour	$4.25016 / 1 hour	$3.0357 / 1 hour
c3d-highcpu-360

360

720 GiB

$13.49316 / 1 hour	$9.7150752 / 1 hour	$7.2863064 / 1 hour	$8.50032 / 1 hour	$6.0714 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

E2 machine types﻿

E2 machine types do not offer sustained use discounts but provide larger savings directly through the on-demand and committed-use prices. E2 machine types provide consistently predictable pricing without the requirement to run a VM for a specific portion of the month.

E2 machine types are also available as shared-core VMs. For pricing information about E2 shared-core machine types, see E2 shared-core machine types.

E2 standard machine types

The following table shows the calculated cost for standard predefined machine types in the E2 machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 4 GiB of memory per vCPU.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

e2-standard-2

2

8 GiB

$0.06701142 / 1 hour	$0.048248226 / 1 hour	$0.036186166 / 1 hour	$0.042217196 / 1 hour	$0.030155144 / 1 hour
e2-standard-4

4

16 GiB

$0.13402284 / 1 hour	$0.096496452 / 1 hour	$0.072372332 / 1 hour	$0.084434392 / 1 hour	$0.060310288 / 1 hour
e2-standard-8

8

32 GiB

$0.26804568 / 1 hour	$0.192992904 / 1 hour	$0.144744664 / 1 hour	$0.168868784 / 1 hour	$0.120620576 / 1 hour
e2-standard-16

16

64 GiB

$0.53609136 / 1 hour	$0.385985808 / 1 hour	$0.289489328 / 1 hour	$0.337737568 / 1 hour	$0.241241152 / 1 hour
e2-standard-32

32

128 GiB

$1.07218272 / 1 hour	$0.771971616 / 1 hour	$0.578978656 / 1 hour	$0.675475136 / 1 hour	$0.482482304 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom E2 machine type could save you as much as 40%. For more information, see E2 custom vCPUs and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

E2 high-memory machine types

The following table shows the calculated cost for the E2 high-memory predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-memory machine types have 8 GiB of memory per vCPU. High-memory instances are ideal for tasks that require more memory relative to virtual CPUs.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

e2-highmem-2

2

16 GiB

$0.09039966 / 1 hour	$0.065087762 / 1 hour	$0.048815814 / 1 hour	$0.056951788 / 1 hour	$0.040679856 / 1 hour
e2-highmem-4

4

32 GiB

$0.18079932 / 1 hour	$0.130175524 / 1 hour	$0.097631628 / 1 hour	$0.113903576 / 1 hour	$0.081359712 / 1 hour
e2-highmem-8

8

64 GiB

$0.36159864 / 1 hour	$0.260351048 / 1 hour	$0.195263256 / 1 hour	$0.227807152 / 1 hour	$0.162719424 / 1 hour
e2-highmem-16

16

128 GiB

$0.72319728 / 1 hour	$0.520702096 / 1 hour	$0.390526512 / 1 hour	$0.455614304 / 1 hour	$0.325438848 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom E2 machine type could save you as much as 40%. For more information, see E2 custom vCPUs and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

E2 high-CPU machine types

The following table shows the calculated cost for E2 high-CPU predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-CPU machine types have one vCPU for every 1 GiB of memory. High-CPU machine types are ideal for tasks that require moderate memory configurations for the needed vCPU count.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

e2-highcpu-2

2

2 GiB

$0.04947024 / 1 hour	$0.035618574 / 1 hour	$0.02671393 / 1 hour	$0.031166252 / 1 hour	$0.02226161 / 1 hour
e2-highcpu-4

4

4 GiB

$0.09894048 / 1 hour	$0.071237148 / 1 hour	$0.05342786 / 1 hour	$0.062332504 / 1 hour	$0.04452322 / 1 hour
e2-highcpu-8

8

8 GiB

$0.19788096 / 1 hour	$0.142474296 / 1 hour	$0.10685572 / 1 hour	$0.124665008 / 1 hour	$0.08904644 / 1 hour
e2-highcpu-16

16

16 GiB

$0.39576192 / 1 hour	$0.284948592 / 1 hour	$0.21371144 / 1 hour	$0.249330016 / 1 hour	$0.17809288 / 1 hour
e2-highcpu-32

32

32 GiB

$0.79152384 / 1 hour	$0.569897184 / 1 hour	$0.42742288 / 1 hour	$0.498660032 / 1 hour	$0.35618576 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom E2 machine type could save you as much as 40%. For more information, see E2 custom vCPUs and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

E2 custom vCPUs and memory

Custom machine types let you set a specific number of vCPUs and GiB of memory for your instances to match the needs of your workload. Custom machine types save you the cost of running on a larger and more expensive machine type if your application does not require all of the resources provided by that machine type.

Read Creating a VM instance with a custom machine type to learn how to use these machine types.

Not all machine types are guaranteed to be available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.02290217 / 1 hour	$0.016489562 / 1 hour	$0.012367172 / 1 hour	$0.000490761 / 1 hour
Custom Memory

$0.003069707 / 1 hour	$0.002210189 / 1 hour	$0.001657642 / 1 hour	$0.000065779 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

The CUDs prices for Custom Machine Types reflect a 5% premium over predefined shapes. The premium applies only for the duration and amount of CMTs used and covered by the CUDs. More details please refer to the documentation for Resource-based committed use discounts.

N2 machine types

N2 standard machine types

The following table shows the calculated costs for standard predefined machine types in the N2 machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 4 GiB of memory per vCPU.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2-standard-2

2

8 GiB

$0.097118 / 1 hour	$0.06992496 / 1 hour	$0.05244372 / 1 hour	$0.061182 / 1 hour	$0.043706 / 1 hour
n2-standard-4

4

16 GiB

$0.194236 / 1 hour	$0.13984992 / 1 hour	$0.10488744 / 1 hour	$0.122364 / 1 hour	$0.087412 / 1 hour
n2-standard-8

8

32 GiB

$0.388472 / 1 hour	$0.27969984 / 1 hour	$0.20977488 / 1 hour	$0.244728 / 1 hour	$0.174824 / 1 hour
n2-standard-16

16

64 GiB

$0.776944 / 1 hour	$0.55939968 / 1 hour	$0.41954976 / 1 hour	$0.489456 / 1 hour	$0.349648 / 1 hour
n2-standard-32

32

128 GiB

$1.553888 / 1 hour	$1.11879936 / 1 hour	$0.83909952 / 1 hour	$0.978912 / 1 hour	$0.699296 / 1 hour
n2-standard-48

48

192 GiB

$2.330832 / 1 hour	$1.67819904 / 1 hour	$1.25864928 / 1 hour	$1.468368 / 1 hour	$1.048944 / 1 hour
n2-standard-64

64

256 GiB

$3.107776 / 1 hour	$2.23759872 / 1 hour	$1.67819904 / 1 hour	$1.957824 / 1 hour	$1.398592 / 1 hour
n2-standard-80

80

320 GiB

$3.88472 / 1 hour	$2.7969984 / 1 hour	$2.0977488 / 1 hour	$2.44728 / 1 hour	$1.74824 / 1 hour
n2-standard-96

96

384 GiB

$4.661664 / 1 hour	$3.35639808 / 1 hour	$2.51729856 / 1 hour	$2.936736 / 1 hour	$2.097888 / 1 hour
n2-standard-128

128

512 GiB

$6.215552 / 1 hour	$4.47519744 / 1 hour	$3.35639808 / 1 hour	$3.915648 / 1 hour	$2.797184 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory .

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2 high-memory machine types

The following table shows the calculated cost for the N2 high-memory predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-memory machine types have 8 GiB of memory per vCPU. High-memory instances are ideal for tasks that require more memory relative to virtual CPUs.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2-highmem-2

2

16 GiB

$0.131014 / 1 hour	$0.09433008 / 1 hour	$0.07074756 / 1 hour	$0.082534 / 1 hour	$0.058962 / 1 hour
n2-highmem-4

4

32 GiB

$0.262028 / 1 hour	$0.18866016 / 1 hour	$0.14149512 / 1 hour	$0.165068 / 1 hour	$0.117924 / 1 hour
n2-highmem-8

8

64 GiB

$0.524056 / 1 hour	$0.37732032 / 1 hour	$0.28299024 / 1 hour	$0.330136 / 1 hour	$0.235848 / 1 hour
n2-highmem-16

16

128 GiB

$1.048112 / 1 hour	$0.75464064 / 1 hour	$0.56598048 / 1 hour	$0.660272 / 1 hour	$0.471696 / 1 hour
n2-highmem-32

32

256 GiB

$2.096224 / 1 hour	$1.50928128 / 1 hour	$1.13196096 / 1 hour	$1.320544 / 1 hour	$0.943392 / 1 hour
n2-highmem-48

48

384 GiB

$3.144336 / 1 hour	$2.26392192 / 1 hour	$1.69794144 / 1 hour	$1.980816 / 1 hour	$1.415088 / 1 hour
n2-highmem-64

64

512 GiB

$4.192448 / 1 hour	$3.01856256 / 1 hour	$2.26392192 / 1 hour	$2.641088 / 1 hour	$1.886784 / 1 hour
n2-highmem-80

80

640 GiB

$5.24056 / 1 hour	$3.7732032 / 1 hour	$2.8299024 / 1 hour	$3.30136 / 1 hour	$2.35848 / 1 hour
n2-highmem-96

96

768 GiB

$6.288672 / 1 hour	$4.52784384 / 1 hour	$3.39588288 / 1 hour	$3.961632 / 1 hour	$2.830176 / 1 hour
n2-highmem-128

128

864 GiB

$7.706976 / 1 hour	$5.54902272 / 1 hour	$4.16176704 / 1 hour	$4.855136 / 1 hour	$3.468448 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPUs and memory .

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2 high-CPU machine types

The following table shows the calculated cost for N2 high-CPU predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-CPU machine types have one vCPU for every 1 GiB of memory. High-CPU machine types are ideal for tasks that require moderate memory configurations for the needed vCPU count.



Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2-highcpu-2

2

2 GiB

$0.071696 / 1 hour	$0.05162112 / 1 hour	$0.03871584 / 1 hour	$0.045168 / 1 hour	$0.032264 / 1 hour
n2-highcpu-4

4

4 GiB

$0.143392 / 1 hour	$0.10324224 / 1 hour	$0.07743168 / 1 hour	$0.090336 / 1 hour	$0.064528 / 1 hour
n2-highcpu-8

8

8 GiB

$0.286784 / 1 hour	$0.20648448 / 1 hour	$0.15486336 / 1 hour	$0.180672 / 1 hour	$0.129056 / 1 hour
n2-highcpu-16

16

16 GiB

$0.573568 / 1 hour	$0.41296896 / 1 hour	$0.30972672 / 1 hour	$0.361344 / 1 hour	$0.258112 / 1 hour
n2-highcpu-32

32

32 GiB

$1.147136 / 1 hour	$0.82593792 / 1 hour	$0.61945344 / 1 hour	$0.722688 / 1 hour	$0.516224 / 1 hour
n2-highcpu-48

48

48 GiB

$1.720704 / 1 hour	$1.23890688 / 1 hour	$0.92918016 / 1 hour	$1.084032 / 1 hour	$0.774336 / 1 hour
n2-highcpu-64

64

64 GiB

$2.294272 / 1 hour	$1.65187584 / 1 hour	$1.23890688 / 1 hour	$1.445376 / 1 hour	$1.032448 / 1 hour
n2-highcpu-80

80

80 GiB

$2.86784 / 1 hour	$2.0648448 / 1 hour	$1.5486336 / 1 hour	$1.80672 / 1 hour	$1.29056 / 1 hour
n2-highcpu-96

96

96 GiB

$3.441408 / 1 hour	$2.47781376 / 1 hour	$1.85836032 / 1 hour	$2.168064 / 1 hour	$1.548672 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2 custom vCPUs and memory

Custom machine types let you set a specific number of vCPUs and GiB of memory for your instances to match the needs of your workload. Custom machine types save you the cost of running on a larger and more expensive machine type if your application does not require all of the resources provided by that machine type.

Read Creating a VM instance with a custom machine type to learn how to use these machine types.

Sustained use discounts for custom machine types are calculated separately from predefined machine types, memory-optimized types, and shared-core machine types.

Not all machine types are guaranteed to be available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.03319155 / 1 hour	$0.023897916 / 1 hour	$0.017923437 / 1 hour	$0.00071125 / 1 hour
Custom Memory

$0.00444885 / 1 gibibyte hour	$0.003203172 / 1 gibibyte hour	$0.002402379 / 1 gibibyte hour	$0.00009535 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

The CUDs prices for Custom Machine Types reflect a 5% premium over predefined shapes. The premium applies only for the duration and amount of CMTs used and covered by the CUDs. More details please refer to the documentation for Resource-based committed use discounts.

N2 extended custom memory

For custom machine types, any memory up to and including 8 GiB of memory per vCPU is charged at the standard custom vCPU and memory pricing rate. Any memory above 8 GiB per vCPU is charged according to the following extended memory prices. To learn how to create instances with custom machine types and extended memory, see Adding extended memory to a machine type.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

Extended custom memory

$0.00955 / 1 gibibyte hour	$0.006876 / 1 gibibyte hour	$0.005157 / 1 gibibyte hour	$0.002669 / 1 gibibyte hour	$0.001907 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2D machine types

N2D standard machine types

The following table shows the calculated costs for standard predefined machine types in the N2D machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 4 GiB of memory per vCPU.



Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2d-standard-2

2

8 GiB

$0.084492 / 1 hour	$0.06083424 / 1 hour	$0.04562568 / 1 hour	$0.053228 / 1 hour	$0.038024 / 1 hour
n2d-standard-4

4

16 GiB

$0.168984 / 1 hour	$0.12166848 / 1 hour	$0.09125136 / 1 hour	$0.106456 / 1 hour	$0.076048 / 1 hour
n2d-standard-8

8

32 GiB

$0.337968 / 1 hour	$0.24333696 / 1 hour	$0.18250272 / 1 hour	$0.212912 / 1 hour	$0.152096 / 1 hour
n2d-standard-16

16

64 GiB

$0.675936 / 1 hour	$0.48667392 / 1 hour	$0.36500544 / 1 hour	$0.425824 / 1 hour	$0.304192 / 1 hour
n2d-standard-32

32

128 GiB

$1.351872 / 1 hour	$0.97334784 / 1 hour	$0.73001088 / 1 hour	$0.851648 / 1 hour	$0.608384 / 1 hour
n2d-standard-48

48

192 GiB

$2.027808 / 1 hour	$1.46002176 / 1 hour	$1.09501632 / 1 hour	$1.277472 / 1 hour	$0.912576 / 1 hour
n2d-standard-64

64

256 GiB

$2.703744 / 1 hour	$1.94669568 / 1 hour	$1.46002176 / 1 hour	$1.703296 / 1 hour	$1.216768 / 1 hour
n2d-standard-80

80

320 GiB

$3.37968 / 1 hour	$2.4333696 / 1 hour	$1.8250272 / 1 hour	$2.12912 / 1 hour	$1.52096 / 1 hour
n2d-standard-96

96

384 GiB

$4.055616 / 1 hour	$2.92004352 / 1 hour	$2.19003264 / 1 hour	$2.554944 / 1 hour	$1.825152 / 1 hour
n2d-standard-128

128

512 GiB

$5.407488 / 1 hour	$3.89339136 / 1 hour	$2.92004352 / 1 hour	$3.406592 / 1 hour	$2.433536 / 1 hour
n2d-standard-224

224

896 GiB

$9.463104 / 1 hour	$6.81343488 / 1 hour	$5.11007616 / 1 hour	$5.961536 / 1 hour	$4.258688 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2D high-memory machine types

The following table shows the calculated cost for the N2D high-memory predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-memory machine types have 8 GiB of memory per vCPU. High-memory instances are ideal for tasks that require more memory relative to virtual CPUs.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2d-highmem-2

2

16 GiB

$0.11398 / 1 hour	$0.0820656 / 1 hour	$0.0615492 / 1 hour	$0.071804 / 1 hour	$0.051296 / 1 hour
n2d-highmem-4

4

32 GiB

$0.22796 / 1 hour	$0.1641312 / 1 hour	$0.1230984 / 1 hour	$0.143608 / 1 hour	$0.102592 / 1 hour
n2d-highmem-8

8

64 GiB

$0.45592 / 1 hour	$0.3282624 / 1 hour	$0.2461968 / 1 hour	$0.287216 / 1 hour	$0.205184 / 1 hour
n2d-highmem-16

16

128 GiB

$0.91184 / 1 hour	$0.6565248 / 1 hour	$0.4923936 / 1 hour	$0.574432 / 1 hour	$0.410368 / 1 hour
n2d-highmem-32

32

256 GiB

$1.82368 / 1 hour	$1.3130496 / 1 hour	$0.9847872 / 1 hour	$1.148864 / 1 hour	$0.820736 / 1 hour
n2d-highmem-48

48

384 GiB

$2.73552 / 1 hour	$1.9695744 / 1 hour	$1.4771808 / 1 hour	$1.723296 / 1 hour	$1.231104 / 1 hour
n2d-highmem-64

64

512 GiB

$3.64736 / 1 hour	$2.6260992 / 1 hour	$1.9695744 / 1 hour	$2.297728 / 1 hour	$1.641472 / 1 hour
n2d-highmem-80

80

640 GiB

$4.5592 / 1 hour	$3.282624 / 1 hour	$2.461968 / 1 hour	$2.87216 / 1 hour	$2.05184 / 1 hour
n2d-highmem-96

96

768 GiB

$5.47104 / 1 hour	$3.9391488 / 1 hour	$2.9543616 / 1 hour	$3.446592 / 1 hour	$2.462208 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPU and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2D high-CPU machine types

The following table shows the calculated cost for the N2D high-cpu predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-cpu machine types have 1 GiB of memory per vCPU. High-cpu instances are ideal for tasks that require more virtual CPUs relative to memory.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n2d-highcpu-2

2

2 GiB

$0.062376 / 1 hour	$0.04491072 / 1 hour	$0.03368304 / 1 hour	$0.039296 / 1 hour	$0.02807 / 1 hour
n2d-highcpu-4

4

4 GiB

$0.124752 / 1 hour	$0.08982144 / 1 hour	$0.06736608 / 1 hour	$0.078592 / 1 hour	$0.05614 / 1 hour
n2d-highcpu-8

8

8 GiB

$0.249504 / 1 hour	$0.17964288 / 1 hour	$0.13473216 / 1 hour	$0.157184 / 1 hour	$0.11228 / 1 hour
n2d-highcpu-16

16

16 GiB

$0.499008 / 1 hour	$0.35928576 / 1 hour	$0.26946432 / 1 hour	$0.314368 / 1 hour	$0.22456 / 1 hour
n2d-highcpu-32

32

32 GiB

$0.998016 / 1 hour	$0.71857152 / 1 hour	$0.53892864 / 1 hour	$0.628736 / 1 hour	$0.44912 / 1 hour
n2d-highcpu-48

48

48 GiB

$1.497024 / 1 hour	$1.07785728 / 1 hour	$0.80839296 / 1 hour	$0.943104 / 1 hour	$0.67368 / 1 hour
n2d-highcpu-64

64

64 GiB

$1.996032 / 1 hour	$1.43714304 / 1 hour	$1.07785728 / 1 hour	$1.257472 / 1 hour	$0.89824 / 1 hour
n2d-highcpu-80

80

80 GiB

$2.49504 / 1 hour	$1.7964288 / 1 hour	$1.3473216 / 1 hour	$1.57184 / 1 hour	$1.1228 / 1 hour
n2d-highcpu-96

96

96 GiB

$2.994048 / 1 hour	$2.15571456 / 1 hour	$1.61678592 / 1 hour	$1.886208 / 1 hour	$1.34736 / 1 hour
n2d-highcpu-128

128

128 GiB

$3.992064 / 1 hour	$2.87428608 / 1 hour	$2.15571456 / 1 hour	$2.514944 / 1 hour	$1.79648 / 1 hour
n2d-highcpu-224

224

224 GiB

$6.986112 / 1 hour	$5.03000064 / 1 hour	$3.77250048 / 1 hour	$4.401152 / 1 hour	$3.14384 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. For more information, see Custom vCPUs and memory.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N2D custom vCPUs and memory

Custom machine types let you set a specific number of vCPUs and GiB of memory for your instances to match the needs of your workload. Custom machine types save you the cost of running on a larger and more expensive machine type if your application does not require all of the resources provided by that machine type.

Read Creating a VM instance with a custom machine type to learn how to use these machine types.

Sustained use discounts for custom machine types are calculated separately from predefined machine types, memory-optimized types, and shared-core machine types.

Not all machine types are guaranteed to be available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.0288771 / 1 hour	$0.020791512 / 1 hour	$0.015593634 / 1 hour	$0.0006188 / 1 hour
Custom Memory

$0.0038703 / 1 gibibyte hour	$0.002786616 / 1 gibibyte hour	$0.002089962 / 1 gibibyte hour	$0.00008295 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

The CUDs prices for Custom Machine Types reflect a 5% premium over predefined shapes. The premium applies only for the duration and amount of CMTs used and covered by the CUDs. More details please refer to the documentation for Resource-based committed use discounts.

N2D extended custom memory

For custom machine types, any memory up to and including 8 GiB of memory per vCPU is charged at the standard custom vCPU and memory pricing rate. Any memory above 8 GiB per vCPU is charged according to the following extended memory prices. To learn how to create instances with custom machine types and extended memory, see Adding extended memory to a machine type.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

Extended custom memory

$0.008309 / 1 gibibyte hour	$0.00598248 / 1 gibibyte hour	$0.00448686 / 1 gibibyte hour	$0.002322 / 1 gibibyte hour	$0.001659 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Tau T2D machine types

Tau T2D standard machine types

The following table shows the calculated costs for standard predefined machine types in the Tau T2D machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type

Standard machine types have 4 GiB of memory per vCPU.

Iowa (us-central1)

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Price (USD)

Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

t2d-standard-1

1

4 GiB

$0.042246 / 1 hour	$0.026614 / 1 hour	$0.019012 / 1 hour
t2d-standard-2

2

8 GiB

$0.084492 / 1 hour	$0.053228 / 1 hour	$0.038024 / 1 hour
t2d-standard-4

4

16 GiB

$0.168984 / 1 hour	$0.106456 / 1 hour	$0.076048 / 1 hour
t2d-standard-8

8

32 GiB

$0.337968 / 1 hour	$0.212912 / 1 hour	$0.152096 / 1 hour
t2d-standard-16

16

64 GiB

$0.675936 / 1 hour	$0.425824 / 1 hour	$0.304192 / 1 hour
t2d-standard-32

32

128 GiB

$1.351872 / 1 hour	$0.851648 / 1 hour	$0.608384 / 1 hour
t2d-standard-48

48

192 GiB

$2.027808 / 1 hour	$1.277472 / 1 hour	$0.912576 / 1 hour
t2d-standard-60

60

240 GiB

$2.53476 / 1 hour	$1.59684 / 1 hour	$1.14072 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Tau T2A machine types

Tau T2A standard machine types

The following table shows the calculated costs for standard predefined machine types in the Tau T2A machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 4 GiB of memory per vCPU.

Iowa (us-central1)

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Price (USD)

t2a-standard-1

1

4 GiB

$0.0385 / 1 hour
t2a-standard-2

2

8 GiB

$0.077 / 1 hour
t2a-standard-4

4

16 GiB

$0.154 / 1 hour
t2a-standard-8

8

32 GiB

$0.308 / 1 hour
t2a-standard-16

16

64 GiB

$0.616 / 1 hour
t2a-standard-32

32

128 GiB

$1.232 / 1 hour
t2a-standard-48

48

192 GiB

$1.848 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N1 machine types

N1 standard machine types

The following table shows the calculated cost for standard predefined machine types in the N1 machine family. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

Standard machine types have 3.75 GiB of memory per vCPU.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n1-standard-1

1

3.75 GiB

$0.04749975 / 1 hour	$0.03419982 / 1 hour	$0.025649865 / 1 hour	$0.02992375 / 1 hour	$0.02137625 / 1 hour
n1-standard-2

2

7.5 GiB

$0.0949995 / 1 hour	$0.06839964 / 1 hour	$0.05129973 / 1 hour	$0.0598475 / 1 hour	$0.0427525 / 1 hour
n1-standard-4

4

15 GiB

$0.189999 / 1 hour	$0.13679928 / 1 hour	$0.10259946 / 1 hour	$0.119695 / 1 hour	$0.085505 / 1 hour
n1-standard-8

8

30 GiB

$0.379998 / 1 hour	$0.27359856 / 1 hour	$0.20519892 / 1 hour	$0.23939 / 1 hour	$0.17101 / 1 hour
n1-standard-16

16

60 GiB

$0.759996 / 1 hour	$0.54719712 / 1 hour	$0.41039784 / 1 hour	$0.47878 / 1 hour	$0.34202 / 1 hour
n1-standard-32

32

120 GiB

$1.519992 / 1 hour	$1.09439424 / 1 hour	$0.82079568 / 1 hour	$0.95756 / 1 hour	$0.68404 / 1 hour
n1-standard-64

64

240 GiB

$3.039984 / 1 hour	$2.18878848 / 1 hour	$1.64159136 / 1 hour	$1.91512 / 1 hour	$1.36808 / 1 hour
n1-standard-96 Skylake Platform only

96

360 GiB

$4.559976 / 1 hour	$3.28318272 / 1 hour	$2.46238704 / 1 hour	$2.87268 / 1 hour	$2.05212 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. Read more about Custom machine types.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N1 high-memory machine types

The following table shows the calculated cost for the N1 high-memory predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-memory machine types have 6.5 GiB of memory per vCPU. High-memory instances are ideal for tasks that require more memory relative to virtual CPUs.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n1-highmem-2

2

13 GiB

$0.118303 / 1 hour	$0.08517816 / 1 hour	$0.06388362 / 1 hour	$0.074527 / 1 hour	$0.053241 / 1 hour
n1-highmem-4

4

26 GiB

$0.236606 / 1 hour	$0.17035632 / 1 hour	$0.12776724 / 1 hour	$0.149054 / 1 hour	$0.106482 / 1 hour
n1-highmem-8

8

52 GiB

$0.473212 / 1 hour	$0.34071264 / 1 hour	$0.25553448 / 1 hour	$0.298108 / 1 hour	$0.212964 / 1 hour
n1-highmem-16

16

104 GiB

$0.946424 / 1 hour	$0.68142528 / 1 hour	$0.51106896 / 1 hour	$0.596216 / 1 hour	$0.425928 / 1 hour
n1-highmem-32

32

208 GiB

$1.892848 / 1 hour	$1.36285056 / 1 hour	$1.02213792 / 1 hour	$1.192432 / 1 hour	$0.851856 / 1 hour
n1-highmem-64

64

416 GiB

$3.785696 / 1 hour	$2.72570112 / 1 hour	$2.04427584 / 1 hour	$2.384864 / 1 hour	$1.703712 / 1 hour
n1-highmem-96 Skylake Platform only

96

624 GiB

$5.678544 / 1 hour	$4.08855168 / 1 hour	$3.06641376 / 1 hour	$3.577296 / 1 hour	$2.555568 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. Read more about Custom machine types.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N1 high-CPU machine types

The following table shows the calculated cost for N1 high-CPU predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual predefined vCPU and memory prices, but these tables provide the cost that you can expect using a specific machine type.

High-CPU machine types have one vCPU for every 0.90 GiB of memory. High-CPU machine types are ideal for tasks that require moderate memory configurations for the needed vCPU count.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

n1-highcpu-2

2

1.80 GiB

$0.0708486 / 1 hour	$0.051010992 / 1 hour	$0.038258244 / 1 hour	$0.0446342 / 1 hour	$0.0318826 / 1 hour
n1-highcpu-4

4

3.60 GiB

$0.1416972 / 1 hour	$0.102021984 / 1 hour	$0.076516488 / 1 hour	$0.0892684 / 1 hour	$0.0637652 / 1 hour
n1-highcpu-8

8

7.20 GiB

$0.2833944 / 1 hour	$0.204043968 / 1 hour	$0.153032976 / 1 hour	$0.1785368 / 1 hour	$0.1275304 / 1 hour
n1-highcpu-16

16

14.40 GiB

$0.5667888 / 1 hour	$0.408087936 / 1 hour	$0.306065952 / 1 hour	$0.3570736 / 1 hour	$0.2550608 / 1 hour
n1-highcpu-32

32

28.80 GiB

$1.1335776 / 1 hour	$0.816175872 / 1 hour	$0.612131904 / 1 hour	$0.7141472 / 1 hour	$0.5101216 / 1 hour
n1-highcpu-64

64

57.60 GiB

$2.2671552 / 1 hour	$1.632351744 / 1 hour	$1.224263808 / 1 hour	$1.4282944 / 1 hour	$1.0202432 / 1 hour
n1-highcpu-96 Skylake Platform only

96

86.40 GiB

$3.4007328 / 1 hour	$2.448527616 / 1 hour	$1.836395712 / 1 hour	$2.1424416 / 1 hour	$1.5303648 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Custom machine type: If your ideal machine shape is in between two predefined types, using a custom machine type could save you as much as 40%. Read more about Custom machine types.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N1 custom vCPUs and memory

Custom machine types let you set a specific number of vCPUs and GiB of memory for your instances to match the needs of your workload. Custom machine types save you the cost of running on a larger and more expensive machine type if your application does not require all of the resources provided by that machine type.

For example, instead of using an n1-standard-8 machine type when you need a machine type with 6 vCPUs, you can create an instance with a custom machine type that has 6 vCPUs and 22.5 GiB of memory. Creating a custom machine type can save you up to 40% compared to selecting a larger machine type. Custom machine types are billed according to the number of vCPUs and the amount of memory used.

Read the Creating instances with custom machine types to learn how to use these machine types.

Sustained use discounts for custom machine types are calculated separately from predefined machine types, memory-optimized types, and shared-core machine types.

Not all machine types are guaranteed to be available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Resource-based commitment price premium (USD)

Custom vCPUs

$0.03319155 / 1 hour	$0.023897916 / 1 hour	$0.017923437 / 1 hour	$0.00071125 / 1 hour
Custom Memory

$0.004446 / 1 gibibyte hour	$0.00320112 / 1 gibibyte hour	$0.00240084 / 1 gibibyte hour	$0.00009535 / 1 gibibyte hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

The CUDs prices for Custom Machine Types reflect a 5% premium over predefined shapes. The premium applies only for the duration and amount of CMTs used and covered by the CUDs. More details please refer to the documentation for Resource-based committed use discounts.

N1 extended custom memory

For custom machine types, any memory up to and including 6.5 GiB of memory per vCPU is charged at the standard custom vCPU and memory pricing rate. Any memory above the 6.5 GiB per vCPU is charged according to the extended memory prices that are described in detail below. See the Extended Memory page to learn how to create instances with custom machine types and extended memory.

The on-demand prices for custom machine types include a 5% premium over the on-demand prices for standard machine types. For an accurate estimate of your billing with custom machine types, use the Google Cloud Pricing Calculator.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Item

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

Extended custom memory

$0.00955 / 1 gibibyte hour	$0.006876 / 1 gibibyte hour	$0.005157 / 1 gibibyte hour	
Unavailable

Unavailable

* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Compute-optimized machine type family
Compute-optimized machine types are ideal for compute-intensive workloads. These machine types offer the highest performance per core on Compute Engine.

H4D machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

h4d-standard-192

192

720 GiB

-

$7.85376 / 1 hour	$6.5186208 / 1 hour	$4.8693312 / 1 hour	$5.890488 / 1 hour	$3.92712 / 1 hour
h4d-highmem-192

192

1488 GiB

-

$8.842944 / 1 hour	$7.33964352 / 1 hour	$5.48262528 / 1 hour	$6.6326064 / 1 hour	$4.4218656 / 1 hour
h4d-highmem-192-lssd

192

1488 GiB

3750 GiB

$9.42409126 / 1 hour	$7.821995746 / 1 hour	$5.842936581 / 1 hour	$7.068464277 / 1 hour	$4.71243923 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

H3 machine types﻿

H3 Standard machine types

The following table shows the calculated cost for h3-standard-88 machine types, which is the H3 predefined machine type. The vCPUs and memory from each of these machine types are billed by their individual compute-optimized vCPUs and memory prices but these tables provide the cost that you can expect using a specific machine type.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Cores

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

h3-standard-88

88

352 GiB

$4.9236 / 1 hour	$4.086588 / 1 hour	$3.052632 / 1 hour	$4.03832 / 1 hour	$2.95592 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C2 machine types

C2 standard machine types

The following table shows the calculated cost for c2-standard machine types, which are C2 predefined machine types. The vCPUs and memory from each of these machine types are billed by their individual compute-optimized vCPUs and memory prices but these tables provide the cost that you can expect using a specific machine type.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c2-standard-4

4

16 GiB

$0.208808 / 1 hour	$0.15034176 / 1 hour	$0.11275632 / 1 hour	$0.13154 / 1 hour	$0.083524 / 1 hour
c2-standard-8

8

32 GiB

$0.417616 / 1 hour	$0.30068352 / 1 hour	$0.22551264 / 1 hour	$0.26308 / 1 hour	$0.167048 / 1 hour
c2-standard-16

16

64 GiB

$0.835232 / 1 hour	$0.60136704 / 1 hour	$0.45102528 / 1 hour	$0.52616 / 1 hour	$0.334096 / 1 hour
c2-standard-30

30

120 GiB

$1.56606 / 1 hour	$1.1275632 / 1 hour	$0.8456724 / 1 hour	$0.98655 / 1 hour	$0.62643 / 1 hour
c2-standard-60

60

240 GiB

$3.13212 / 1 hour	$2.2551264 / 1 hour	$1.6913448 / 1 hour	$1.9731 / 1 hour	$1.25286 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

C2D machine types

C2D Standard machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

vCPU

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c2d-standard-2

2

8 GiB

$0.090798 / 1 hour	$0.06537456 / 1 hour	$0.04903092 / 1 hour	$0.0572 / 1 hour	$0.040854 / 1 hour
c2d-standard-4

4

16 GiB

$0.181596 / 1 hour	$0.13074912 / 1 hour	$0.09806184 / 1 hour	$0.1144 / 1 hour	$0.081708 / 1 hour
c2d-standard-8

8

32 GiB

$0.363192 / 1 hour	$0.26149824 / 1 hour	$0.19612368 / 1 hour	$0.2288 / 1 hour	$0.163416 / 1 hour
c2d-standard-16

16

64 GiB

$0.726384 / 1 hour	$0.52299648 / 1 hour	$0.39224736 / 1 hour	$0.4576 / 1 hour	$0.326832 / 1 hour
c2d-standard-32

32

128 GiB

$1.452768 / 1 hour	$1.04599296 / 1 hour	$0.78449472 / 1 hour	$0.9152 / 1 hour	$0.653664 / 1 hour
c2d-standard-56

56

224 GiB

$2.542344 / 1 hour	$1.83048768 / 1 hour	$1.37286576 / 1 hour	$1.6016 / 1 hour	$1.143912 / 1 hour
c2d-standard-112

112

448 GiB

$5.084688 / 1 hour	$3.66097536 / 1 hour	$2.74573152 / 1 hour	$3.2032 / 1 hour	$2.287824 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C2D Highmem machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

vCPU

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c2d-highmem-2

2

16 GiB

$0.12247 / 1 hour	$0.0881784 / 1 hour	$0.0661338 / 1 hour	$0.077152 / 1 hour	$0.055102 / 1 hour
c2d-highmem-4

4

32 GiB

$0.24494 / 1 hour	$0.1763568 / 1 hour	$0.1322676 / 1 hour	$0.154304 / 1 hour	$0.110204 / 1 hour
c2d-highmem-8

8

64 GiB

$0.48988 / 1 hour	$0.3527136 / 1 hour	$0.2645352 / 1 hour	$0.308608 / 1 hour	$0.220408 / 1 hour
c2d-highmem-16

16

128 GiB

$0.97976 / 1 hour	$0.7054272 / 1 hour	$0.5290704 / 1 hour	$0.617216 / 1 hour	$0.440816 / 1 hour
c2d-highmem-32

32

256 GiB

$1.95952 / 1 hour	$1.4108544 / 1 hour	$1.0581408 / 1 hour	$1.234432 / 1 hour	$0.881632 / 1 hour
c2d-highmem-56

56

448 GiB

$3.42916 / 1 hour	$2.4689952 / 1 hour	$1.8517464 / 1 hour	$2.160256 / 1 hour	$1.542856 / 1 hour
c2d-highmem-112

112

896 GiB

$6.85832 / 1 hour	$4.9379904 / 1 hour	$3.7034928 / 1 hour	$4.320512 / 1 hour	$3.085712 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C2D Highcpu machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

vCPU



Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

c2d-highcpu-2

2

4 GiB

$0.074962 / 1 hour	$0.05397264 / 1 hour	$0.04047948 / 1 hour	$0.047224 / 1 hour	$0.03373 / 1 hour
c2d-highcpu-4

4

8 GiB

$0.149924 / 1 hour	$0.10794528 / 1 hour	$0.08095896 / 1 hour	$0.094448 / 1 hour	$0.06746 / 1 hour
c2d-highcpu-8

8

16 GiB

$0.299848 / 1 hour	$0.21589056 / 1 hour	$0.16191792 / 1 hour	$0.188896 / 1 hour	$0.13492 / 1 hour
c2d-highcpu-16

16

32 GiB

$0.599696 / 1 hour	$0.43178112 / 1 hour	$0.32383584 / 1 hour	$0.377792 / 1 hour	$0.26984 / 1 hour
c2d-highcpu-32

32

64 GiB

$1.199392 / 1 hour	$0.86356224 / 1 hour	$0.64767168 / 1 hour	$0.755584 / 1 hour	$0.53968 / 1 hour
c2d-highcpu-56

56

128 GiB

$2.098936 / 1 hour	$1.51123392 / 1 hour	$1.13342544 / 1 hour	$1.322272 / 1 hour	$0.94444 / 1 hour
c2d-highcpu-112

112

224 GiB

$4.197872 / 1 hour	$3.02246784 / 1 hour	$2.26685088 / 1 hour	$2.644544 / 1 hour	$1.88888 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Memory-optimized machine type family
Memory-optimized machine types are ideal for tasks that require intensive use of memory with higher memory to vCPU ratios than the general-purpose n2-highmem machine types. Memory-optimized machine types are available in certain regions only. To learn more about memory-optimized machine types, see Memory-optimized machine family.

Not all machine types are guaranteed to be available in all zones all the time. To ensure that a machine type is available when you need it, you can preemptively reserve the machine type in a certain zone. For information about reserving predefined machine types in a specific zone, see Reservations of Compute Engine zonal resources.

M4 machine types

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine Type

Cores (Hyper threaded)

Memory (GB)

Storage

Standard Networking

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

m4-ultramem-56

56

1488 GiB

Hyperdisk

32 Gbps

$7.8237504 / 1 hour	$7.8237504 / 1 hour	$2.894787648 / 1 hour	$4.6160152 / 1 hour	$2.347124 / 1 hour
m4-ultramem-112

112

2976 GiB

Hyperdisk

50 Gbps

$15.6475008 / 1 hour	$15.6475008 / 1 hour	$5.789575296 / 1 hour	$9.2320304 / 1 hour	$4.694248 / 1 hour
m4-ultramem-224

224

5,952 GiB

Hyperdisk

100 Gbps

$41.464125836 / 1 hour	$41.464125836 / 1 hour	$15.341729116 / 1 hour	$24.463839356 / 1 hour	$12.439212187 / 1 hour
m4-megamem-28

28

372 GiB

Hyperdisk

32 Gbps

$2.2118352 / 1 hour	$2.2118352 / 1 hour	$0.818379024 / 1 hour	$1.304984 / 1 hour	$0.66355 / 1 hour
m4-megamem-56

56

744 GiB

Hyperdisk

32 Gbps

$4.4236704 / 1 hour	$4.4236704 / 1 hour	$1.636758048 / 1 hour	$2.609968 / 1 hour	$1.3271 / 1 hour
m4-megamem-112

112

1488 GiB

Hyperdisk

50 Gbps

$8.8473408 / 1 hour	$8.8473408 / 1 hour	$3.273516096 / 1 hour	$5.219936 / 1 hour	$2.6542 / 1 hour
m4-megamem-224

224

2976 GiB

Hyperdisk

100 Gbps

$17.6946816 / 1 hour	$17.6946816 / 1 hour	$6.547032192 / 1 hour	$10.439872 / 1 hour	$5.3084 / 1 hour
m4-hypermem-16

16

248 GiB

750 MiB/s

16 Gbps

$1.4258144 / 1 hour	$1.4258144 / 1 hour	$0.527551328 / 1 hour	$0.8412312 / 1 hour	$0.427744 / 1 hour
m4-hypermem-32

32

496 GiB

1500 MiB/s

32 Gbps

$2.8516288 / 1 hour	$2.8516288 / 1 hour	$1.055102656 / 1 hour	$1.6824624 / 1 hour	$0.855488 / 1 hour
m4-hypermem-64

64

992 GiB

3250 MiB/s

32 Gbps

$5.7032576 / 1 hour	$5.7032576 / 1 hour	$2.110205312 / 1 hour	$3.3649248 / 1 hour	$1.710976 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
M3 machine types

M3 machine types offer 3rd Generation Intel Scalable Processors (Ice Lake). Currently, M3 machine types are only available in certain regions and zones. The following table shows the calculated cost for m3-megamem and m3-ultramem machine types. The vCPUs and memory from each of these machine types are billed by their individual M3 vCPUs and memory prices but these tables provide the cost that you can expect using a specific machine type.

These machine types are only available in select zones.

Note: M3 machine types do not offer sustained use discounts.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

m3-ultramem-32

32

976 GiB

$6.0912 / 1 hour	$6.0912 / 1 hour	$2.253744 / 1 hour	$3.60512 / 1 hour	$1.82768 / 1 hour
m3-ultramem-64

64

1952 GiB

$12.1824 / 1 hour	$12.1824 / 1 hour	$4.507488 / 1 hour	$7.21024 / 1 hour	$3.65536 / 1 hour
m3-ultramem-128

128

3904 GiB

$24.3648 / 1 hour	$24.3648 / 1 hour	$9.014976 / 1 hour	$14.42048 / 1 hour	$7.31072 / 1 hour
m3-megamem-64

64

976 GiB

$7.2048 / 1 hour	$7.2048 / 1 hour	$2.665776 / 1 hour	$4.26272 / 1 hour	$2.16208 / 1 hour
m3-megamem-128

128

1952 GiB

$14.4096 / 1 hour	$14.4096 / 1 hour	$5.331552 / 1 hour	$8.52544 / 1 hour	$4.32416 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
Committed Use Discounts apply to memory-optimized machine types only if you buy the commitment type specifically for M3 machine types.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

M2 machine types

The following table shows the calculated cost for M2 machine types. To use these machine types, you must request quota using one of the following options:

Request access to evaluation quota so that you can test the performance of these machine types. Any VMs you create with these machine types count against the evaluation quota and are billed using the evaluative prices listed below. Evaluation quota persists only for a limited amount of time on your project.
Purchase a 1 year or 3 year commitment for sustained usage. Commitments are not billed incrementally. Commitments bill you a monthly fee for the duration of your commitment term even if you do not use any of the committed resources.
These machine types are only available in select zones.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

m2-ultramem-208

208

5888 GiB

$42.111936 / 1 hour	$42.111936 / 1 hour	$15.58141632 / 1 hour	$26.900896 / 1 hour	$16.026976 / 1 hour
m2-ultramem-416

416

11776 GiB

$84.223872 / 1 hour	$84.223872 / 1 hour	$31.16283264 / 1 hour	$53.801792 / 1 hour	$32.053952 / 1 hour
m2-megamem-416

416

5888 GiB

$50.291328 / 1 hour	$50.291328 / 1 hour	$18.60779136 / 1 hour	$32.116288 / 1 hour	$19.141568 / 1 hour
m2-hypermem-416

416

8832 GiB

$67.2576 / 1 hour	$67.2576 / 1 hour	$24.885312 / 1 hour	$42.95904 / 1 hour	$25.59776 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
M1 machine types

The following table shows the calculated cost for m1-megamem and m1-ultramem machine types. The vCPUs and memory from each of these machine types are billed by their individual memory-optimized vCPUs and memory prices but these tables provide the cost that you can expect using a specific machine type.

These machine types are only available in select zones.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

m1-ultramem-40

40

961 GiB

$6.2931 / 1 hour	$6.2931 / 1 hour	$2.328447 / 1 hour	$3.72422 / 1 hour	$1.88833 / 1 hour
m1-ultramem-80

80

1922 GiB

$12.5862 / 1 hour	$12.5862 / 1 hour	$4.656894 / 1 hour	$7.44844 / 1 hour	$3.77666 / 1 hour
m1-ultramem-160

160

3844 GiB

$25.1724 / 1 hour	$25.1724 / 1 hour	$9.313788 / 1 hour	$14.89688 / 1 hour	$7.55332 / 1 hour
m1-megamem-96

96

1433.60 GiB

$10.65216 / 1 hour	$10.65216 / 1 hour	$3.9412992 / 1 hour	$6.302272 / 1 hour	$3.196608 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
Committed Use Discounts apply to memory-optimized machine types only if you buy the commitment type specifically for memory-optimized machine types.

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Storage-optimized machine type family
The storage-optimized machine family is suitable for workloads that are low in core usage and high in storage density. For example, the Z3 machine series is useful for scale-out analytics workloads, flash-optimized databases, and other database workloads.

Z3 machine types

Z3 VMs are powered by the 4th generation Intel Xeon Scalable processors (code-named Sapphire Rapids), DDR5 memory, Google's custom Intel Infrastructure Processing Engine (IPU), and the latest generation of Local SSD.

Z3 highmem machine types

The following table shows the calculated cost for z3-highmem-xx-standardlssd and z3-highmem-xx-highlssd machine types, which are the Z3 predefined machine types. The vCPUs, memory, and Local SSD storage from each of these machine types are billed by their individual storage-optimized vCPU, memory, and Local SSD disk prices, but these tables provide the total cost that you can expect using a specific machine type.

Z3 highmem machine types with standardlssd

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Cores

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

z3-highmem-14-standardlssd

14

112 GiB

3,000 GiB

$1.769304123 / 1 hour	$1.273898969 / 1 hour	$0.955424227 / 1 hour	$1.114657888 / 1 hour	$0.796188605 / 1 hour
z3-highmem-22-standardlssd

22

176 GiB

6,000 GiB

$2.921235247 / 1 hour	$2.103289378 / 1 hour	$1.577467033 / 1 hour	$1.840372375 / 1 hour	$1.314558611 / 1 hour
z3-highmem-44-standardlssd

44

352 GiB

9,000 GiB

$5.51370337 / 1 hour	$3.969866426 / 1 hour	$2.97739982 / 1 hour	$3.473621463 / 1 hour	$2.481172016 / 1 hour
z3-highmem-88-standardlssd

88

704 GiB

18,000 GiB

$11.02740674 / 1 hour	$7.939732853 / 1 hour	$5.954799639 / 1 hour	$6.947242926 / 1 hour	$4.962344033 / 1 hour
z3-highmem-176-standardlssd

176

1408 GiB

36,000 GiB

$22.054813479 / 1 hour	$15.879465705 / 1 hour	$11.909599279 / 1 hour	$13.894485852 / 1 hour	$9.924688066 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Z3 highmem machine types with highlssd

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

Cores

Memory

Local SSD

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

z3-highmem-8-highlssd

8

64 GiB

3,000 GiB

$1.151931123 / 1 hour	$0.829390409 / 1 hour	$0.622042807 / 1 hour	$0.725714488 / 1 hour	$0.518370005 / 1 hour
z3-highmem-16-highlssd

16

128 GiB

6,000 GiB

$2.303862247 / 1 hour	$1.658780818 / 1 hour	$1.244085613 / 1 hour	$1.451428975 / 1 hour	$1.036740011 / 1 hour
z3-highmem-22-highlssd

22

176 GiB

9,000 GiB

$3.25000237 / 1 hour	$2.340001706 / 1 hour	$1.75500128 / 1 hour	$2.047495663 / 1 hour	$1.462503816 / 1 hour
z3-highmem-32-highlssd

32

256 GiB

12,000 GiB

$4.607724493 / 1 hour	$3.317561635 / 1 hour	$2.488171226 / 1 hour	$2.902857951 / 1 hour	$2.073480022 / 1 hour
z3-highmem-44-highlssd

44

352 GiB

18,000 GiB

$6.50000474 / 1 hour	$4.680003413 / 1 hour	$3.510002559 / 1 hour	$4.094991326 / 1 hour	$2.925007633 / 1 hour
z3-highmem-88-highlssd

88

704 GiB

36,000 GiB

$13.000009479 / 1 hour	$9.360006825 / 1 hour	$7.020005119 / 1 hour	$8.189982652 / 1 hour	$5.850015266 / 1 hour
z3-highmem-192-highlssd-metal

192

1,536 GiB

72,000 GiB

$27.646346959 / 1 hour	$19.90536981 / 1 hour	$14.929027358 / 1 hour	$17.417147704 / 1 hour	$12.440880132 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

Accelerator-optimized machine type family
Accelerator-optimized VMs are optimized for massively parallelized CUDA compute workloads, such as machine learning (ML) and high performance computing (HPC).

The accelerator-optimized machine types are billed for their attached GPUs, predefined vCPU, memory, and bundled Local SSD storage (if applicable).

The total cost of running each accelerator-optimized machine type is shown in the following tables. For VMs that have custom memory options available, the default memory value is used in the calculation. These machine types are not eligible for sustained use discounts or flexible committed use discounts.

DWS Prices are variable, but are updated infrequently. You pay the price that is in effect when your instances are running. See Flex-start documentation and Calendar mode documentation to learn more.

Iowa (us-central1)

Hourly

Monthly
Machine type

GPU

Components

On-Demand (USD)

DWS Flex-start price (USD)

DWS Calendar Mode price (USD)

Current Spot pricing (USD)

Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

A4 High

a4-highgpu-8g

Nvidia B200

GPUs: 8

vCPUs: 224

Memory: 3,968GB

SSD: 12,000 GiB

N/A

$64.4400 / 1 hour

$90.2200 / 1 hour

$32.6064 / 1 hour	$88.9272 / 1 hour	$56.7072 / 1 hour
A3 Ultra

a3-ultragpu-8g

Nvidia H200

GPUs: 8

vCPUs: 224

Memory: 2,952GB

SSD: 12,000 GiB

$84.806908493 / 1 hour	
$42.4000 / 1 hour

$59.3600 / 1 hour

$42.164814247 / 1 hour	$58.471933151 / 1 hour	$37.208420822 / 1 hour
A3 Mega

a3-megagpu-8g

Nvidia H100

GPUs: 8

vCPUs: 208

Memory: 1,872GB

SSD: 6,000 GiB

$93.400712807 / 1 hour	
$40.3200 / 1 hour

$44.0000 / 1 hour

$27.190911123 / 1 hour	$64.206558727 / 1 hour	$40.650103355 / 1 hour
A3 High

a3-highgpu-8g

Nvidia H100

GPUs: 8

vCPUs: 208

Memory: 1,871GB

SSD: 6,000 GiB

$88.490000119 / 1 hour	
$38.3200 / 1 hour

$41.6000 / 1 hour

$25.762031123 / 1 hour	$61.383674231 / 1 hour	$38.864383195 / 1 hour
A2 Ultra

a2-ultragpu-1g

Nvidia A100

GPUs: 1

vCPUs: 12

Memory: 170GB

SSD: 275 GiB

$5.06879789 / 1 hour	
$2.4000 / 1 hour

N/A

$2.526827945 / 1 hour	
N/A

N/A

a2-ultragpu-2g

Nvidia A100

GPUs: 2

vCPUs: 24

Memory: 340GB

SSD: 750 GiB

$10.137595781 / 1 hour	
$4.8000 / 1 hour

N/A



$5.05365589 / 1 hour	
N/A

N/A

a2-ultragpu-4g



Nvidia A100

GPUs: 4

vCPUs:48

Memory: 680GB

SSD: 1,500 GiB

$20.275191562 / 1 hour	
$9.6000 / 1 hour

N/A

$10.107311781 / 1 hour	
N/A

N/A

a2-ultragpu-8g

Nvidia A100

GPUs: 8

vCPUs: 96

Memory: 1,360GB

SSD: 3,000 GiB

$40.550383123 / 1 hour	
$19.2000 / 1 hour

N/A

$20.214623562 / 1 hour	
N/A

N/A

A2 Standard

a2-highgpu-1g

Nvidia A100

GPUs: 1

vCPUs: 12

Memory: 85GiB

$3.673385 / 1 hour	
$2.0000 / 1 hour

N/A

$1.80385 / 1 hour	$2.31420704 / 1 hour	$1.285708338 / 1 hour
a2-highgpu-2g

Nvidia A100

GPUs: 2

vCPUs: 24

Memory: 170GiB

$7.34677 / 1 hour	
$4.0000 / 1 hour

N/A

$3.6077 / 1 hour	$4.62841408 / 1 hour	$2.571416676 / 1 hour
a2-highgpu-4g

Nvidia A100

GPUs:4

vCPUs: 48

Memory: 340GiB

$14.69354 / 1 hour	
$8.0000 / 1 hour

N/A

$7.2154 / 1 hour	$9.25682816 / 1 hour	$5.142833352 / 1 hour
a2-highgpu-8g

Nvidia A100

GPUs: 8

vCPUs: 96

Memory: 680GiB

$29.38708 / 1 hour	
$16.0000 / 1 hour

N/A

$14.4308 / 1 hour	$18.51365632 / 1 hour	$10.285666704 / 1 hour
a2-megagpu-16g

Nvidia A100

GPUs: 16

vCPUs: 96

Memory:1,360GiB

$55.739504 / 1 hour	
N/A

N/A

$27.34384 / 1 hour	$35.11547264 / 1 hour	$19.509200064 / 1 hour
G4 Standard

g4-standard-48

NVIDIA RTX PRO 6000

GPUs: 1

vCPUs: 48

Memory: 180GiB

$4.49993 / 1 hour	
$2.2500 / 1 hour

N/A

$1.80062 / 1 hour	$3.105 / 1 hour	$1.97945 / 1 hour
g4-standard-96

NVIDIA RTX PRO 6000





GPUs: 2

vCPUs: 96

Memory: 360GiB

$8.99986 / 1 hour	
$4.5 / 1 hour

N/A

$3.60124 / 1 hour	$6.21 / 1 hour	$3.9589 / 1 hour
﻿g4-standard-192





NVIDIA RTX PRO 6000





GPUs: 4

vCPUs: 192

Memory: 720GiB

$17.99972 / 1 hour	
$9.0000 / 1 hour

N/A

$7.20248 / 1 hour	$12.42 / 1 hour	$7.9178 / 1 hour
g4-standard-384





NVIDIA RTX PRO 6000





GPUs: 8

vCPUs: 384

Memory: 1440GiB

$35.99944 / 1 hour	
$18.0000 / 1 hour

N/A

$14.40496 / 1 hour	$24.84 / 1 hour	$15.8356 / 1 hour
G2 Standard

g2-standard-4

NVIDIA L4

GPUs: 1

vCPUs: 4

Memory: 16GiB

$0.706832276 / 1 hour	
N/A

N/A

$0.281836 / 1 hour	$0.445304335 / 1 hour	$0.318074524 / 1 hour
g2-standard-8

NVIDIA L4

GPUs: 1

vCPUs: 8

Memory: 32GiB

$0.853624312 / 1 hour	
N/A

N/A

$0.340572 / 1 hour	$0.537783319 / 1 hour	$0.38413094 / 1 hour
g2-standard-12

NVIDIA L4

GPUs: 1

vCPUs: 12

Memory: 48GiB

$1.000416348 / 1 hour	
N/A

N/A

$0.399308 / 1 hour	$0.630262303 / 1 hour	$0.450187356 / 1 hour
g2-standard-16

NVIDIA L4

GPUs: 1

vCPUs: 16

Memory: 64GiB

$1.147208384 / 1 hour	
N/A

N/A

$0.458044 / 1 hour	$0.722741287 / 1 hour	$0.516243772 / 1 hour
g2-standard-24

NVIDIA L4

GPUs: 2

vCPUs: 24

Memory: 96GiB

$2.000832696 / 1 hour	
N/A

N/A

$0.798616 / 1 hour	$1.260524606 / 1 hour	$0.900374712 / 1 hour
g2-standard-32

NVIDIA L4

GPUs: 1

vCPUs: 32

Memory: 128GiB

$1.734376528 / 1 hour	
N/A

N/A

$0.692988 / 1 hour	$1.092657223 / 1 hour	$0.780469436 / 1 hour
g2-standard-48

NVIDIA L4

GPUs: 4

vCPUs: 48

Memory: 192GiB

$4.001665392 / 1 hour	
N/A

N/A

$1.597232 / 1 hour	$2.521049212 / 1 hour	$1.800749424 / 1 hour
g2-standard-96

NVIDIA L4

GPUs: 8

vCPUs: 96

Memory: 384GiB

$8.003330784 / 1 hour	
N/A

N/A

$1.597232 / 1 hour	$5.042098424 / 1 hour	$3.601498848 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply. 

GPU options

You can attach one or more GPUs to your virtual machine (VM) instances to accelerate specific workloads or offload work from your vCPUs. Each GPU adds to the cost of your instance in addition to the cost of the machine type. GPUs are subject to the same billing policy as vCPUs and memory.

Compute Engine charges for usage based on the following price sheet. A bill is sent out at the end of each billing cycle, providing a sum of Google Cloud charges. Prices on this page are listed in U.S. dollars (USD). For Compute Engine, disk size, machine type memory, and network usage are calculated in JEDEC binary gigabytes (GB), or IEC gibibytes (GiB), where 1 GiB is 230 bytes. Similarly, 1 TiB is 240 bytes, or 1024 JEDEC GBs. If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.



Iowa (us-central1)

Hourly

Monthly
Model

GPUs Configuration

GPU Memory Configuration

Price per GPU (USD)

Compute Resource CUDs - 1 Year per GPU (USD)

Compute Resource CUDs - 3 Year per GPU (USD)

NVIDIA T4

1,2 or 4 GPUs

16, 32 or 64 GB GDDR6

$0.35 / 1 hour	$0.22 / 1 hour	$0.16 / 1 hour
NVIDIA P4

1,2 or 4 GPUs

16, 32 or 64 GB GDDR6

$0.60 / 1 hour	$0.378 / 1 hour	$0.27 / 1 hour
NVIDIA V100

1,2,4, or 8 GPUs

16, 32, 64 or 128 GB GDDR6

$2.48 / 1 hour	$1.562 / 1 hour	$1.116 / 1 hour
NVIDIA P100

1,2 or 4 GPUs

16, 32 or 64 GB HBM2

$1.46 / 1 hour	$0.919 / 1 hour	$0.657 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Spot prices are dynamic and can change up to once every 30 days, but provide discounts of 60-91% off of the corresponding on-demand price for most machine types and GPUs. Spot prices also provide smaller discounts for local SSDs and A3 machine types. For more information, see the Spot VMs documentation.

DWS Prices are variable, but are updated infrequently. You pay the price that is in effect when your instances are running. See Flex-start documentation and Calendar mode documentation to learn more.

Shared-core machine types
Unlike predefined machine types and custom machine types, shared-core machine types are not billed on their individual resources. Each machine type has a defined price for both vCPUs and memory.

Shared-core machine types offer bursting capabilities that allow instances to use additional physical CPU for short periods of time. Bursting doesn't incur any additional charges. You are charged the listed on-demand price for your VMs.

E2 shared-core machine types

When you use E2 shared-core machine types, your VM runs two vCPUs simultaneously shared on one physical core for a specific fraction of time in the following ways, depending on the machine type:

e2-micro sustains 2 vCPUs, each for 12.5% of CPU time, totaling 25% CPU time and effectively consuming 0.25 cores.
e2-small sustains 2 vCPUs, each at 25% of CPU time, totaling 50% CPU time and effectively consuming 0.50 cores.
e2-medium sustains 2 vCPUs, each at 50% of CPU time, totaling 100% CPU time and effectively consuming 1.0 cores.
Each vCPU can burst up to 100% of CPU time, for short periods, before returning to its prescribed CPU time limitation.

E2 shared-core VMs are eligible for discounts from resource-based CUDs and spot VMs. These VMs are not eligible for flexible CUDs and SUDs.

When you purchase a commitment for vCPUs, you need to commit to a minimum of 1 vCPU. e2-micro and e2-small machine types effectively consume less than 1 vCPU. As a result, when you purchase a commitment for either of these machine types, ensure that your commitment meets the following minimum VM requirements:

At least 4 VMs if you want to commit to e2-micro resources.
At least 2 VMs if you want to commit to e2-small resources.
For more information, see E2 shared core machine types and CPU bursting.

Iowa (us-central1)
Show discount options

Hourly

Monthly
Machine type

vCPUs

Memory

Default* (USD)
Compute Flexible CUD - 1 Year* (USD)
Compute Flexible CUD - 3 Year* (USD)
Compute Resource CUDs - 1 Year (USD)

Compute Resource CUDs - 3 Year (USD)

e2-micro

2

1 GiB

$0.008376428 / 1 hour	$0.006031028 / 1 hour	$0.004523271 / 1 hour	$0.00527715 / 1 hour	$0.003769393 / 1 hour
e2-small

2

2 GiB

$0.016752855 / 1 hour	$0.012062057 / 1 hour	$0.009046542 / 1 hour	$0.010554299 / 1 hour	$0.007538786 / 1 hour
e2-medium

2

4 GiB

$0.03350571 / 1 hour	$0.024124113 / 1 hour	$0.018093083 / 1 hour	$0.021108598 / 1 hour	$0.015077572 / 1 hour
* Each consumption model has a unique ID. You may need to opt-in to be eligible for consumption model discounts. Click here to learn more.
* The Default consumption model for Compute Engine is "On Demand"

If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

N1 shared-core machine types

N1 shared-core VMs are available as f1-micro and g1-small machine types. VMs of both machine types run a single vCPU for a specific fraction of time in the following manner:

f1-micro sustains a single vCPU for up to 20% of CPU time.
g1-small sustains a single vCPU for up to 50% of CPU time.
Each vCPU can burst up to 100% of CPU time, for short periods, before returning to its prescribed CPU time limitations.

Discounts for N1 shared-core machine types apply in the following way:

N1 shared-core VMs are eligible for discounts from SUDs and spot VMs. SUDs for these VMs are calculated separately from N1 predefined and custom VMs.
N1 shared-core VMs are not eligible for resource-based or flexible CUDs.
Learn more about N1 shared-core machine types.

Iowa (us-central1)

Hourly

Monthly
Machine type

Virtual CPUs

Memory

Price (USD)

f1-micro

0.2

0.60 GiB

$0.0076 / 1 hour
g1-small

0.5

1.70 GiB

$0.0257 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Tier_1 higher bandwidth network pricing
You can configure your N2, N2D, C2, C2D, C3, C3D, C4, C4A, C4D, Z3 and M3 machine types to use per VM Tier_1 networking performance. The following machine series require a minimum number of vCPUs to use this feature:

C2 and C3D: at least 30 vCPUs
C2D, C4A, and N2: at least 32 vCPUs
C3: at least 44 vCPUs
C4D, C4 and N2D: at least 48 vCPUs
M3: at least 64 vCPUs
Pricing is also dependent upon the regions and zones where the VM is located.

N2, N2D, C2, C2D, M3

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps (N2, N2D, C2, C2D, M3)

$0.44895 / 1 hour
75 Gbps (N2 only)

$0.673425 / 1 hour
100 Gbps (N2, N2D, C2, C2D, M3)

$0.8979 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3

The cost of using Tier_1 networking with C3 is described below.

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps

$0.18 / 1 hour
100 Gbps

$0.38 / 1 hour
200 Gbps

$1.00 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C3D

The cost of using Tier_1 networking with C3D is described in the following table.

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps

$0.30 / 1 hour
75 Gbps

$0.35 / 1 hour
100 Gbps

$0.40 / 1 hour
150 Gbps

$0.50 / 1 hour
200 Gbps

$1.00 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4

The cost of using Tier_1 networking with C4 is described in the following table.

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps

$0.16 / 1 hour
100 Gbps

$0.33 / 1 hour
200 Gbps

$1.00 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

C4A

The cost of using Tier_1 networking with C4A is described in the following table.

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps (32vCPU)

$0.27 / 1 hour
50 Gbps (48vCPU)

$0.16 / 1 hour
75 Gbps

$0.30 / 1 hour
100 Gbps

$0.50 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.

Z3

The cost of using Tier_1 networking with Z3 is described in the following table.

Iowa (us-central1)

Hourly

Monthly
Item

Price (USD)

50 Gbps

$0.18 / 1 hour
100 Gbps

$0.38 / 1 hour
200 Gbps

$1.00 / 1 hour
If you pay in a currency other than USD, the prices listed in your currency on Cloud Platform SKUs apply.



Simulated maintenance event pricing
Starting February 10, 2020, there is no cost to running simulated maintenance events.

Note: Normal 1-minute-minimum usage charges for machine types and premium images still apply to instances that you stop or Spot VMs (or preemptible VMs) during a simulated maintenance event. See the machine type billing model and premium image pricing for details.

Prior to this date, the following charges apply:

Simulated maintenance on instances configured for live migration incur costs for each of the following instance resources:
Price per vCPU on the instance, where f1-micro and g1-small are each equivalent to 1 vCPU: $0.040
Price per GB of memory: $0.010
Price per GB of Local SSD space: $0.001
Simulated maintenance on Spot VMs (and preemptible VMs): Free
Simulated maintenance on instances configured to stop and restart: Free
Suspended VM instances
When you suspend an instance, Compute Engine preserves the memory and device state. While you are not charged for the VM instance as if it were running, suspended instances still incur charges for the following:

Suspended instance memory and device state.
Suspended Local SSD data & metadata.
Any Persistent Disk usage.
Any static IPs attached to the VM instance.
Note: Suspended Instance and Local SSD state are stored in Persistent Disk volumes and as such are subject to Persistent Disk pricing. All preserved state charges in this section are prorated based on a granularity of seconds. For example, if you suspended 1 GB of space for half the month, then you are charged for only half of the month.

Iowa (us-central1)

Hourly

Monthly
Type

Price (USD)

Instance memory and device state

$0.000232877 / 1 gibibyte hour
Confidential VM instances
Confidential VM instances use hardware-based memory encryption to help ensure your data and applications can't be read or modified while in use. You can configure specific machine types (see Supported machine types) to use the Confidential VM service. Confidential VM incurs additional costs on top of Compute Engine pricing. See Confidential VM pricing.

What's next
Read the Compute Engine documentation.
Get started with Compute Engine.
Learn about Compute Engine solutions and use cases.
Learn more about Compute Engine machine types.
Refer to the Pricing Overview documentation.
Review Disk and image pricing, Networking pricing, Sole-tenant node pricing, Confidential VM pricing, or GPU pricing.
Try the Pricing Calculator.
Request a custom quote
With Google Cloud's pay-as-you-go pricing, you only pay for the services you use. Connect with our sales team to get a custom quote for your organization.
Google Cloud
Overview
Solutions
Products
Pricing
Resources
Contact us

Docs
Support
Console

Google Developer Program
Dashboard
Saved pages
Communities and Programs
Profile
Google Developers
Join the Google Developer Program
Unlock AI tools, exclusive training, and insider access. Join today and accelerate your developer journey.
Why Google
Choosing Google Cloud
Trust and security
Modern Infrastructure Cloud
Multicloud
Global infrastructure
Locations
Customers and case studies
Analyst reports
Whitepapers
Blog
Products and pricing
Google Cloud pricing
Google Workspace pricing
See all products
Solutions
Infrastructure modernization
Databases
Application modernization
Smart analytics
Artificial Intelligence
Security
Productivity & work transformation
Industry solutions
DevOps solutions
Small business solutions
See all solutions
Resources
Google Cloud Affiliate Program
Google Cloud documentation
Google Cloud quickstarts
Google Cloud Marketplace
Learn about cloud computing
Support
Code samples
Cloud Architecture Center
Training
Certifications
Google for Developers
Google Cloud for Startups
System status
Release Notes
Engage
Contact sales
Find a Partner
Become a Partner
Events
Podcasts
Developer Center
Press Corner
Google Cloud on YouTube
Google Cloud Tech on YouTube
Follow on X
Join User Research
We're hiring. Join Google Cloud!
Community forums
About Google
Privacy
Site terms
Google Cloud terms
Our third decade of climate action: join us
Sign up for the Google Cloud newsletter
‪English‬
