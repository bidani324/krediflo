import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ArrowRight, ArrowLeft, CheckCircle2, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { maskPan } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateLoan, CreateLoanBodyLoanType, CreateApplicantBodyApplicantType } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const loanTypeEnum = z.enum(["lap", "home", "personal", "business"]);

const applicantSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().length(10, "Mobile must be 10 digits"),
  pan: z.string().length(10, "PAN must be 10 characters"),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
});

const formSchema = z.object({
  loanType: loanTypeEnum,
  loanAmount: z.coerce.number().min(10000, "Minimum amount is 10,000"),
  tenure: z.coerce.number().min(12, "Minimum tenure is 12 months"),
  purpose: z.string().optional(),
  primaryApplicant: applicantSchema,
  coApplicants: z.array(applicantSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const steps = [
  { id: "loan-details", title: "Loan Details", description: "What kind of loan do you need?" },
  { id: "primary-applicant", title: "Your Details", description: "Tell us about yourself" },
  { id: "co-applicants", title: "Co-Applicants", description: "Add co-applicants to improve eligibility" },
  { id: "review", title: "Review & Submit", description: "Review your application" }
];

export default function Apply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createLoan = useCreateLoan();
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loanType: "home",
      loanAmount: 5000000,
      tenure: 240,
      primaryApplicant: {
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        pan: "",
      },
      coApplicants: [],
    },
  });

  const { formState: { errors } } = form;

  const nextStep = async () => {
    let isValid = false;
    if (currentStep === 0) {
      isValid = await form.trigger(["loanType", "loanAmount", "tenure"]);
    } else if (currentStep === 1) {
      isValid = await form.trigger(["primaryApplicant"]);
    } else if (currentStep === 2) {
      isValid = await form.trigger(["coApplicants"]);
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: FormValues) => {
    createLoan.mutate({
      data: {
        loanType: data.loanType as CreateLoanBodyLoanType,
        loanAmount: data.loanAmount,
        tenure: data.tenure,
        purpose: data.purpose,
        primaryApplicant: {
          ...data.primaryApplicant,
          applicantType: "primary" as CreateApplicantBodyApplicantType,
        },
      }
    }, {
      onSuccess: (res) => {
        toast({
          title: "Application Submitted",
          description: "Your loan application has been created successfully.",
        });
        setLocation(`/dashboard/${res.id}`);
      },
      onError: () => {
        toast({
          title: "Submission Failed",
          description: "There was an error submitting your application. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Loan Application</h1>
        <p className="text-muted-foreground">Complete this 4-step wizard to apply for a new loan.</p>
      </div>

      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-cyan-600 transition-all duration-500 ease-in-out" 
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold bg-background z-10 transition-colors ${index <= currentStep ? 'border-cyan-600 text-cyan-600' : 'border-muted text-muted-foreground'}`}>
              {index < currentStep ? <CheckCircle2 className="w-6 h-6" /> : index + 1}
            </div>
            <span className="text-xs font-medium mt-2 hidden sm:block text-muted-foreground">
              {step.title}
            </span>
          </div>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="p-4 sm:p-8 pb-2">
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStep === 0 && (
                    <div className="grid gap-6">
                      <FormField
                        control={form.control}
                        name="loanType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Type</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                              >
                                {["home", "lap", "personal", "business"].map((type) => (
                                  <FormItem key={type}>
                                    <FormControl>
                                      <div className="relative">
                                        <RadioGroupItem value={type} id={`type-${type}`} className="peer sr-only" />
                                        <Label
                                          htmlFor={`type-${type}`}
                                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-cyan-600 peer-data-[state=checked]:text-cyan-600 cursor-pointer"
                                        >
                                          <span className="font-semibold uppercase tracking-wider text-sm">{type}</span>
                                        </Label>
                                      </div>
                                    </FormControl>
                                  </FormItem>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="loanAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Loan Amount (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="tenure"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tenure (Months)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="primaryApplicant.firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="primaryApplicant.lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="primaryApplicant.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="primaryApplicant.mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="primaryApplicant.pan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PAN Number</FormLabel>
                            <FormControl>
                              <Input className="uppercase" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="grid gap-6">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <h3 className="font-semibold">Add Co-Applicants</h3>
                          <p className="text-sm text-muted-foreground">Adding co-applicants can increase your loan eligibility.</p>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const current = form.getValues("coApplicants") || [];
                            form.setValue("coApplicants", [
                              ...current, 
                              { firstName: "", lastName: "", email: "", mobile: "", pan: "" }
                            ]);
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-2" /> Add
                        </Button>
                      </div>

                      {form.watch("coApplicants")?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                          No co-applicants added. Click "Add" to include one.
                        </div>
                      ) : (
                        form.watch("coApplicants")?.map((_, index) => (
                          <Card key={index} className="border-border">
                            <CardHeader className="py-4 flex flex-row items-center justify-between">
                              <CardTitle className="text-sm font-semibold">Co-Applicant {index + 1}</CardTitle>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  const current = form.getValues("coApplicants") || [];
                                  form.setValue("coApplicants", current.filter((_, i) => i !== index));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                              <FormField
                                control={form.control}
                                name={`coApplicants.${index}.firstName`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`coApplicants.${index}.lastName`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`coApplicants.${index}.pan`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>PAN Number</FormLabel>
                                    <FormControl><Input className="uppercase" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`coApplicants.${index}.email`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input type="email" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-cyan-50 dark:bg-cyan-950/20 p-6 border border-cyan-100 dark:border-cyan-900/30">
                        <h3 className="font-semibold text-lg mb-4 text-cyan-800 dark:text-cyan-400">Application Summary</h3>
                        
                        <div className="grid grid-cols-2 gap-y-4 text-sm">
                          <div className="text-muted-foreground">Loan Type</div>
                          <div className="font-medium uppercase">{form.getValues("loanType")}</div>
                          
                          <div className="text-muted-foreground">Loan Amount</div>
                          <div className="font-medium font-mono">₹{form.getValues("loanAmount").toLocaleString()}</div>
                          
                          <div className="text-muted-foreground">Tenure</div>
                          <div className="font-medium">{form.getValues("tenure")} Months</div>
                          
                          <div className="text-muted-foreground">Primary Applicant</div>
                          <div className="font-medium">{form.getValues("primaryApplicant.firstName")} {form.getValues("primaryApplicant.lastName")}</div>
                          
                          <div className="text-muted-foreground">PAN</div>
                          <div className="font-medium uppercase">{maskPan(form.getValues("primaryApplicant.pan"))}</div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-cyan-600 shrink-0" />
                        <p>By submitting this application, you consent to Krediflo accessing your CIBIL score and fetching required documents via the Krediflo Instant Verification Engine for evaluation.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between pt-6 border-t mt-6">
                <Button 
                  type="button" 
                  variant="outline"
                  className="h-11"
                  onClick={prevStep} 
                  disabled={currentStep === 0 || createLoan.isPending}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button type="button" className="h-11" onClick={nextStep}>
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createLoan.isPending} className="h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white">
                    {createLoan.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
